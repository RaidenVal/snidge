# Snidge

Electron + TypeScript 桌面取色工具（macOS / Windows）。

## 仓库约定

- 包管理：npm。核心脚本：`npm run dev`（electron-vite dev）、`npm run typecheck`（node+web）、`npm run lint`（`oxlint --deny-warnings .`）、`npm run format`（`oxfmt --write .`）、`npm test`（vitest）。
- Lint/format 用 [Oxc](https://oxc.rs/)（oxlint + oxfmt），不是 ESLint/Prettier。
- 测试用 vitest，测试文件跟源码同目录、同名 `.test.ts`。
- 代码注释默认不写，只有"为什么"不直观时才加一行；不留注释掉的死代码。
- macOS 原生取色 helper：`native/macos-sampler/` + `scripts/build-macos-sampler.sh`，Node 侧封装在 `src/main/macosSampler.ts`。Windows 原生截图 helper 见下方。

## Git 工作方式（本仓库通用规则）

- 开 feature branch，分支上可以直接 commit + push。
- commit message 简短、descriptive，一件事一个 commit，不加 AI co-author，作者是 RaidenVal。
- 未经用户明确同意，不合并到 main、不开 PR。

---

## 当前工作：Windows 原生截图 helper（WGC）

### 背景

Windows 端 `desktopCapturer.getSources()` 本身很慢（3440x1440 上 ~500ms，4K 上 ~700-780ms），是取色延迟的最后一个大瓶颈。之前已经做完的优化（不在本次范围内，仅供背景参考）：修 StrictMode 双重截图请求、传图链路换 raw bitmap、hide 等待改事件驱动 + 32ms settle。

本次任务：用 `Windows.Graphics.Capture`（WGC）写一个独立 Rust exe 做截图，绕开 `desktopCapturer`，目标把截图耗时降到 ~100ms 级。`desktopCapturer` 保留作 fallback（helper 不可用/崩溃/超时/旧 Windows 时自动回退），**功能不允许因为这条新路径而回退**。

### 架构

和 macOS 的 `NSColorSampler` helper 对称：

- 独立 Rust exe（不是 napi addon）：`native/windows-capture-helper/`，产物 `snidge-wgc-capture.exe`
- 构建脚本：`scripts/build-windows-capture-helper.ps1`（`cargo build --release` + 拷贝到 `resources/win/`，该 exe 本身不进 git，见 `.gitignore`）
- Main process 侧封装：`src/main/windowsCapture.ts`（spawn + 协议解析 + 超时 + fallback，纯解析逻辑单独拆成可单测的函数/类）
- 用的 crate：[`windows-capture`](https://github.com/NiiightmareXD/windows-capture) 2.0.0（单帧用法：`on_frame_arrived` 里 `frame.buffer()?.as_nopadding_buffer(&mut scratch)` 拿像素，立刻 `capture_control.stop()`）
- 多屏匹配额外用了底层 `windows` crate（0.62.2，需要和 `windows-capture` 内部版本对齐）直接调 Win32 API（`GetMonitorInfoW`、`MonitorFromPoint`、`SetProcessDpiAwarenessContext`）

### stdout 二进制协议

stdout 只写 binary，stderr 只写日志（helper 自己的日志会被 Node 侧转发进 `[capture]` 日志流，加 `[wgc]` 前缀）。

```
magic "SNWG"   4 bytes
version        u16 LE
header_len     u16 LE   (= 32，为将来加字段留的余量)
width          u32 LE
height         u32 LE
stride         u32 LE   (无 padding，恒等于 width * 4)
format         u32 LE   (1 = BGRA8)
data_len       u64 LE
payload        data_len 字节，BGRA8 原始像素
```

全部小端序（x86_64 native + Node `readUInt32LE` 天然对应）。Node 侧流式读：先攒够 8 字节读 `header_len`，再攒够 `header_len` 读完整 header，之后**预分配一次 payload buffer，按 offset 拷贝**，不用 `Buffer.concat` 反复拷贝大块数据（`WgcFrameAssembler`）。

### 命令行参数（多显示器匹配）

Node 侧 spawn 时按顺序传 6 个整数参数（物理像素，可能为负）：

```
<rectX> <rectY> <rectWidth> <rectHeight> <cursorX> <cursorY>
```

不传参数（或参数不足 7 个含 argv[0]）→ 走"随便选第一个枚举到的屏幕"，方便手动测试。

Rust 侧三层兜底（`select_monitor`）：
1. 拿每个屏幕的物理 rect（`GetMonitorInfoW`）跟传入的 rect 精确比对
2. 都没匹配上 → 用鼠标物理坐标问系统在哪个屏幕上（`MonitorFromPoint`）
3. 上面都失败 → 随便选第一个枚举到的屏幕

**已踩坑**：helper 进程默认不是 DPI-aware，`GetMonitorInfoW` 会返回缩放后的虚拟坐标，跟 WGC 截图给的真实物理像素对不上，导致 rect 永远匹配不到。修法：`main()` 一开始调 `SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)`。

Node 侧传参前，rect 要用 `screen.dipToScreenRect(display.bounds)` 转成物理像素（不能假设 Electron 的 `display.id == HMONITOR`），鼠标坐标同理用物理坐标；这两个值都要 `Math.round`（Rust 侧 `.parse::<i32>()` 遇到带小数点的字符串会直接解析失败，静默丢参数）。

### 已知限制 / 已接受的行为

- **黄色捕获边框**：`DrawBorderSettings::WithoutBorder` 在实测机器上直接报错（`BorderConfigUnsupported`），已改用 `Default`——边框会闪一下，产品上接受这个结果，不为了关边框引入 packaged manifest 复杂度。
- **HDR 屏色彩偏差**：第一版固定用 `ColorFormat::Bgra8`，色彩偏差问题记 TODO，不在本任务处理。
- **helper 的两个硬性要求**：spawn 加 2 秒硬超时（超时 kill 进程 + fallback）；helper stderr 全部转发进 `[capture]` 日志流并加 `[wgc]` 前缀。均已在 `runWindowsCapture` 里实现。

### 进度（按小步计划）

- [x] **Step 1** Rust helper skeleton：能编译、能截一帧主屏、stdout 输出合法协议（commit `2dac5fc`）
- [x] **Step 2** `windowsCapture.ts`：路径解析 + 协议解析（纯函数+单测）+ 流式拼帧（单测）+ spawn/超时/fallback（commit `9bbf7d7`）
- [x] **Step 3.1** Rust 侧多显示器匹配 + DPI 感知修复（commit `582c935`）
- [ ] **Step 3.2** `windowsCapture.ts` 把 rect + 鼠标坐标传给 spawn（`buildWindowsCaptureArgs`，进行中）
- [ ] **Step 3.3** 接入 `src/main/index.ts` 的 `triggerCapture()` win32 分支：算物理 rect、调用 `runWindowsCapture`、把返回的 BGRA buffer 转成 `NativeImage`、失败则原样回退到现有 `desktopCapturer` 路径
- [ ] **Step 4** 全流程手测：`npm run dev` 实测、多显示器、纯红 `#FF0000` 通道测试（验证 BGRA/RGBA 没搞反）、改名 exe 模拟崩溃测 fallback、确认耗时降到 ~100ms 级

### 协作方式（这个工作流专属，其他任务不一定适用）

用户是 Rust 新手、TypeScript/Electron 老手，这部分工作按"新手结对编程"来：解释思路 + 给代码 + 说明验证方法，让用户自己敲/跑，报错先解释再改；不要在没被要求的情况下直接改这个工作流下的文件（除非用户明确说"你帮我做/改"）。Rust 部分的解释要比 TS 部分更耐心、更口语化，避免术语堆砌（用户明确反馈过"像看天书"）。涉及 Windows 原生 API 的具体函数签名/字段名，写代码前先去核实真实源码（`docs.rs` 摘要曾经给错过名字），不要凭记忆/摘要瞎写。
