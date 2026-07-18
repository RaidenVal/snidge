use windows_capture::capture::{Context, GraphicsCaptureApiHandler};
use windows_capture::d3d11::create_d3d_device;
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::{GraphicsCaptureApi, InternalCaptureControl};
use windows_capture::monitor::Monitor;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings, GraphicsCaptureItemType,
    MinimumUpdateIntervalSettings, SecondaryWindowSettings,
};

use parking_lot::Mutex;
use std::io::{self, BufRead, Write};
use std::mem;
use std::sync::Arc;
use std::time::Instant;

use windows::Win32::Foundation::{POINT, RECT, S_FALSE};
use windows::Win32::Graphics::Direct3D11::{ID3D11Device, ID3D11DeviceContext};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, HMONITOR, MONITOR_DEFAULTTONULL, MONITORINFO, MonitorFromPoint,
};
use windows::Win32::System::Com::{CO_MTA_USAGE_COOKIE, CoDecrementMTAUsage, CoIncrementMTAUsage};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::System::WinRT::{
    CreateDispatcherQueueController, DQTAT_COM_NONE, DQTYPE_THREAD_CURRENT, DispatcherQueueOptions,
    RO_INIT_MULTITHREADED, RoInitialize, RoUninitialize,
};
use windows::Win32::UI::HiDpi::{DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, SetProcessDpiAwarenessContext};
use windows::Win32::UI::WindowsAndMessaging::{DispatchMessageW, GetMessageW, MSG, TranslateMessage};

const MAGIC: &[u8; 4] = b"SNWG";
const VERSION: u16 = 1;
const HEADER_LEN: u16 = 32;
const FORMAT_BGRAB: u32 = 1;

// 包裹标签（header）：写清楚"这张图多宽、多高、什么格式、里面数据有多少字节"
// 包裹内容（payload）：真正的像素数据
//
// 这个进程现在是常驻的：D3D 设备、WinRT 初始化、dispatcher queue 只在 main() 顶部建一次，
// 之后在一个循环里反复读 stdin 的一行请求、截一帧、写回 stdout，直到 stdin 关闭才退出。
// 这样每次取色不用重新付一次"建 D3D 设备"的开销（实测在部分机器上这一步单独就要 ~500ms）。

fn main() -> std::process::ExitCode {
    let process_started_at = Instant::now();

    if let Err(err) = unsafe { SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) } {
        eprintln!("failed to set DPI awareness: {err}");
    }

    match GraphicsCaptureApi::is_supported() {
        Ok(true) => {}
        Ok(false) => {
            eprintln!("Windows Graphics Capture is not supported on this system");
            return std::process::ExitCode::FAILURE;
        }
        Err(err) => {
            eprintln!("failed to check Graphics Capture support: {err}");
            return std::process::ExitCode::FAILURE;
        }
    }

    let _winrt = match WinRtGuard::new() {
        Ok(guard) => guard,
        Err(err) => {
            eprintln!("{err}");
            return std::process::ExitCode::FAILURE;
        }
    };

    // dispatcher queue 是 WinRT 事件（比如"这一帧到了"）能被 GetMessageW 消息循环收到的前提条件，
    // 整个进程只建一次，_controller 要活到 main() 结束（丢弃了它 WinRT 事件可能就收不到了）
    let dispatcher_options = DispatcherQueueOptions {
        dwSize: mem::size_of::<DispatcherQueueOptions>() as u32,
        threadType: DQTYPE_THREAD_CURRENT,
        apartmentType: DQTAT_COM_NONE,
    };
    let _controller = match unsafe { CreateDispatcherQueueController(dispatcher_options) } {
        Ok(controller) => controller,
        Err(err) => {
            eprintln!("failed to create dispatcher queue controller: {err}");
            return std::process::ExitCode::FAILURE;
        }
    };

    let thread_id = unsafe { GetCurrentThreadId() };

    let (d3d_device, d3d_device_context) = match create_d3d_device() {
        Ok(pair) => pair,
        Err(err) => {
            eprintln!("failed to create D3D device: {err}");
            return std::process::ExitCode::FAILURE;
        }
    };

    eprintln!("[timing] ready for requests, elapsed since process start={:?}", process_started_at.elapsed());

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(line) => line,
            Err(err) => {
                eprintln!("failed to read stdin: {err}");
                break;
            }
        };

        eprintln!("[timing] read request line, elapsed since process start={:?}", process_started_at.elapsed());

        let target = match parse_target_line(&line) {
            Ok(target) => target,
            Err(()) => {
                eprintln!("ignoring malformed request line: {line:?}");
                continue;
            }
        };

        let request_started_at = Instant::now();

        let monitor = match select_monitor(target.as_ref()) {
            Ok(monitor) => monitor,
            Err(err) => {
                eprintln!("{err}");
                continue;
            }
        };

        eprintln!("selected monitor: {monitor:?}");

        if let Err(err) = capture_one_frame(&d3d_device, &d3d_device_context, monitor, thread_id) {
            eprintln!("capture failed: {err}");
            continue;
        }

        eprintln!("[timing] request handled in {:?}", request_started_at.elapsed());
    }

    eprintln!("[timing] stdin closed after {:?}, exiting", process_started_at.elapsed());
    std::process::ExitCode::SUCCESS
}

// WinRT 要求先在当前线程"报到"（加入 MTA、调 RoInitialize）才能用，整个进程只做一次。
// 照抄 windows-capture crate 内部 WinRT 结构体的做法（那个类型是 crate 私有的，用不了，只能自己写一份）。
struct WinRtGuard {
    mta_cookie: CO_MTA_USAGE_COOKIE,
}

impl WinRtGuard {
    fn new() -> Result<Self, String> {
        let mta_cookie =
            unsafe { CoIncrementMTAUsage() }.map_err(|err| format!("failed to join MTA: {err}"))?;

        match unsafe { RoInitialize(RO_INIT_MULTITHREADED) } {
            Ok(()) => {}
            Err(err) if err.code() == S_FALSE => {}
            Err(err) => {
                unsafe { CoDecrementMTAUsage(mta_cookie).ok() };
                return Err(format!("failed to initialize WinRT: {err}"));
            }
        }

        Ok(Self { mta_cookie })
    }
}

impl Drop for WinRtGuard {
    fn drop(&mut self) {
        unsafe {
            RoUninitialize();
            let _ = CoDecrementMTAUsage(self.mta_cookie);
        }
    }
}

struct SingleFrameCapture;

impl GraphicsCaptureApiHandler for SingleFrameCapture {
    type Flags = ();
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn new(_ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        Ok(Self)
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        let frame_buffer = frame.buffer()?;
        let width = frame_buffer.width();
        let height = frame_buffer.height();

        let mut scratch = Vec::new();
        let pixels = frame_buffer.as_nopadding_buffer(&mut scratch);

        write_frame(width, height, width * 4, pixels)?;

        capture_control.stop();
        Ok(())
    }
}

// 用共享的 D3D 设备建一次性的截图会话：建 session -> 开始截图 -> 等第一帧(或者会话被关闭) -> 关 session。
// 设备本身不在这里建，是外面 main() 传进来复用的。
fn capture_one_frame(
    d3d_device: &ID3D11Device,
    d3d_device_context: &ID3D11DeviceContext,
    monitor: Monitor,
    thread_id: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    let item_with_details: GraphicsCaptureItemType =
        monitor.try_into().map_err(|err: windows::core::Error| Box::new(err) as Box<dyn std::error::Error>)?;

    let result = Arc::new(Mutex::new(None));
    let ctx = Context { flags: (), device: d3d_device.clone(), device_context: d3d_device_context.clone() };
    let callback: Arc<Mutex<SingleFrameCapture>> = Arc::new(Mutex::new(
        SingleFrameCapture::new(ctx).map_err(|err| -> Box<dyn std::error::Error> { err })?,
    ));

    let mut capture = GraphicsCaptureApi::new(
        d3d_device.clone(),
        d3d_device_context.clone(),
        item_with_details,
        callback,
        CursorCaptureSettings::Default,
        DrawBorderSettings::Default,
        SecondaryWindowSettings::Default,
        MinimumUpdateIntervalSettings::Default,
        DirtyRegionSettings::Default,
        ColorFormat::Bgra8,
        thread_id,
        result.clone(),
    )?;

    capture.start_capture()?;

    let mut message = MSG::default();
    unsafe {
        while GetMessageW(&mut message, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }

    capture.stop_capture();

    if let Some(err) = result.lock().take() {
        return Err(err);
    }

    Ok(())
}

fn write_frame(width: u32, height: u32, stride: u32, payload: &[u8]) -> io::Result<()> {
    // Prepare the output stream = stdout
    let stdout = io::stdout();
    let mut out = stdout.lock();

    // Pack the header and payload to stdout
    out.write_all(MAGIC)?;
    out.write_all(&VERSION.to_le_bytes())?;
    out.write_all(&HEADER_LEN.to_le_bytes())?;
    out.write_all(&width.to_le_bytes())?;
    out.write_all(&height.to_le_bytes())?;
    out.write_all(&stride.to_le_bytes())?;
    out.write_all(&FORMAT_BGRAB.to_le_bytes())?;
    out.write_all(&(payload.len() as u64).to_le_bytes())?;
    out.write_all(payload)?;

    // Send the output to electron
    out.flush()
}

// Electron 传过来的目标屏幕物理位置 + 鼠标物理坐标（兜底用）
struct TargetRect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    cursor_x: i32,
    cursor_y: i32,
}

// 解析 stdin 收到的一行请求："x y width height cursorX cursorY"。
// 空行（trim 后为空）当成"没传目标"，方便手动测试时直接敲回车触发一次截图；
// 非空但解析不出 6 个整数的行，返回 Err(()) 让调用方跳过这一行、记日志、继续等下一行。
fn parse_target_line(line: &str) -> Result<Option<TargetRect>, ()> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let mut parts = trimmed.split_whitespace();
    let target = (|| -> Option<TargetRect> {
        Some(TargetRect {
            x: parts.next()?.parse().ok()?,
            y: parts.next()?.parse().ok()?,
            width: parts.next()?.parse().ok()?,
            height: parts.next()?.parse().ok()?,
            cursor_x: parts.next()?.parse().ok()?,
            cursor_y: parts.next()?.parse().ok()?,
        })
    })();

    target.map(Some).ok_or(())
}

// 调 Windows 原生 API 拿这个屏幕在桌面上的物理位置和范围
fn monitor_rect(monitor: &Monitor) -> Option<RECT> {
    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };

    let hmonitor = HMONITOR(monitor.as_raw_hmonitor());
    let ok = unsafe { GetMonitorInfoW(hmonitor, &mut info) };

    if ok.as_bool() {
        Some(info.rcMonitor)
    } else {
        None
    }
}

// 位置和大小都对上，才认为是同一个屏幕
fn monitor_matches_rect(monitor: &Monitor, target: &TargetRect) -> bool {
    let Some(rect) = monitor_rect(monitor) else {
        return false;
    };

    rect.left == target.x
        && rect.top == target.y
        && rect.right - rect.left == target.width
        && rect.bottom - rect.top == target.height
}

// 三层兜底：rect 精确匹配 -> 鼠标所在屏幕 -> 随便挑第一个
fn select_monitor(target: Option<&TargetRect>) -> Result<Monitor, String> {
    let monitors = Monitor::enumerate().map_err(|err| format!("failed to enumerate monitors: {err}"))?;
    if let Some(target) = target {
        // 第一层：拿物理 rect 一个个比对
        for monitor in &monitors {
            if monitor_matches_rect(monitor, target) {
                return Ok(Monitor::from_raw_hmonitor(monitor.as_raw_hmonitor()));
            }
        }

        eprintln!("no monitor matched target rect, falling back to cursor position");

        // 第二层：rect 没匹配上，改用鼠标当前物理坐标去问系统"这在哪个屏幕上"
        let point = POINT { x: target.cursor_x, y: target.cursor_y };
        let hmonitor = unsafe { MonitorFromPoint(point, MONITOR_DEFAULTTONULL) };
        if !hmonitor.is_invalid() {
            return Ok(Monitor::from_raw_hmonitor(hmonitor.0));
        }

        eprintln!("MonitorFromPoint also failed, falling back to first enumerated monitor");
    }
    // 第三层：什么都没传，或者前两层都失败，随便选第一个屏幕
    monitors.into_iter().next().ok_or_else(|| "no monitors found".to_string())
}
