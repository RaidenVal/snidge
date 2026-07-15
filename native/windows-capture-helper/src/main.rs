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

const MAGIC: &[u8; 4] = b"SNWG";
const VERSION: u16 = 1;
const HEADER_LEN: u16 =32;
const FORMAT_BGRAB: u32 = 1;

// 包裹标签（header）：写清楚"这张图多宽、多高、什么格式、里面数据有多少字节"
// 包裹内容（payload）：真正的像素数据

fn main() -> std::process::ExitCode {
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

    let monitors = match Monitor::enumerate() {
        Ok(monitors) => monitors,
        Err(err) => {
            eprintln!("[wgc] failed to enumerate monitors: {err}");
            return std::process::ExitCode::FAILURE;
        }
    };

    let Some(monitor) = monitors.into_iter().next() else {
        eprintln!("[wgc] no monitor found");
        return std::process::ExitCode::FAILURE;
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