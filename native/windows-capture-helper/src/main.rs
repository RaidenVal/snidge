use windows_capture::graphics_capture_api::GraphicsCaptureApi;
use windows_capture::monitor::Monitor;

use windows_capture::capture::{Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::InternalCaptureControl;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
    MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};

use std::io:: {self, Write};

use windows::Win32::Foundation::{POINT, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, HMONITOR, MONITOR_DEFAULTTONULL, MONITORINFO, MonitorFromPoint
};
use windows::Win32::UI::HiDpi::{DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, SetProcessDpiAwarenessContext};

const MAGIC: &[u8; 4] = b"SNWG";
const VERSION: u16 = 1;
const HEADER_LEN: u16 =32;
const FORMAT_BGRAB: u32 = 1;

// 包裹标签（header）：写清楚"这张图多宽、多高、什么格式、里面数据有多少字节"
// 包裹内容（payload）：真正的像素数据

fn main() -> std::process::ExitCode {
    // 声明这个进程能处理 DPI 缩放，不然 GetMonitorInfoW 这类老 API 会返回缩放后的虚拟坐标，跟真实物理像素对不上
    if let Err(err) = unsafe { SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) } {
        eprintln!("[wgc] failed to set DPI awareness: {err}");
    }

    match GraphicsCaptureApi::is_supported() {
        Ok(true) => {}
        Ok(false) => {
            eprintln!("[wgc] Windows Graphics Capture is not supported on this system");
            return std::process::ExitCode::FAILURE;
        }
        Err(err) => {
            eprintln!("[wgc] failed to check Graphics Capture support: {err}");
            return std::process::ExitCode::FAILURE;
        }
    }

    // 没传命令行参数就是 None，select_monitor 会走"随便挑一个屏幕"兜底
    let target = parse_target_rect();
    let monitor = match select_monitor(target.as_ref()) {
        Ok(monitor) => monitor,
        Err(err) => {
            eprintln!("[wgc] {err}");
            return std::process::ExitCode::FAILURE;
        }
    };

    eprintln!("[wgc] selected monitor: {monitor:?}");

    let settings = Settings::new(
        monitor,
        CursorCaptureSettings::Default,
        DrawBorderSettings::Default,
        SecondaryWindowSettings::Default,
        MinimumUpdateIntervalSettings::Default,
        DirtyRegionSettings::Default,
        ColorFormat::Bgra8,
        (),
    );

    if let Err(err) = SingleFrameCapture::start(settings) {
        eprintln!("[wgc] capture failed: {err}");
        return std::process::ExitCode::FAILURE;
    }

    std::process::ExitCode::SUCCESS
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
    out.write_all(&payload)?;

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

// 从命令行参数解析目标 rect，没传够参数就返回 None（手动测试时可以不传）
fn parse_target_rect() -> Option<TargetRect> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 7 {
        return None;
    }

    Some(TargetRect {
        x: args[1].parse().ok()?,
        y: args[2].parse().ok()?,
        width: args[3].parse().ok()?,
        height: args[4].parse().ok()?,
        cursor_x: args[5].parse().ok()?,
        cursor_y: args[6].parse().ok()?,
    })
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

        eprintln!("[wgc] no monitor matched target rect, falling back to cursor position");

        // 第二层：rect 没匹配上，改用鼠标当前物理坐标去问系统"这在哪个屏幕上"
        let point = POINT { x: target.cursor_x, y: target.cursor_y };
        let hmonitor = unsafe { MonitorFromPoint(point, MONITOR_DEFAULTTONULL) };
        if !hmonitor.is_invalid() {
            return Ok(Monitor::from_raw_hmonitor(hmonitor.0));
        }

        eprintln!("[wgc] MonitorFromPoint also failed, falling back to first enumerated monitor");
    }
    // 第三层：什么都没传，或者前两层都失败，随便选第一个屏幕
    monitors.into_iter().next().ok_or_else(|| "no monitors found".to_string())
}