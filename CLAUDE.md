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

工作分支：`feature/windows-wgc-capture`（从 main 干净分出来，只含这个 feature；一开始误接在 `win-capture-hide-event-settle` 上，发现后拆开了，见下方"已踩坑"）。

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
- **已踩坑：本地 `main` 曾经和 `origin/main` 分叉**（历史被重写过，本地是旧的、缺 Oxc 迁移和 hide-event-settle 那次 PR #16 合并）。新开分支前一定要 `git fetch` 并确认本地 main 和 `origin/main` 一致，不要凭本地分支名字/状态想当然。这次是从错误的本地 `main` 分出 `feature/windows-wgc-capture` 后才发现 `npm run lint` 报 `eslint not found`（应该是 `oxlint`），才顺藤摸瓜查出来，靠 rebase 到正确的 `origin/main` 修复的。

### 进度（按小步计划）

- [x] **Step 1** Rust helper skeleton：能编译、能截一帧主屏、stdout 输出合法协议
- [x] **Step 2** `windowsCapture.ts`：路径解析 + 协议解析（纯函数+单测）+ 流式拼帧（单测）+ spawn/超时/fallback
- [x] **Step 3.1** Rust 侧多显示器匹配 + DPI 感知修复
- [x] **Step 3.2** `windowsCapture.ts` 把 rect + 鼠标坐标传给 spawn（`buildWindowsCaptureArgs`，commit `e180593`）
- [x] **Step 3.3** 接入 `src/main/index.ts` 的 `triggerCapture()` win32 分支：算物理 rect（`screen.dipToScreenRect(null, display.bounds)`，注意要传 window 参数）、鼠标坐标也要转物理像素（`screen.dipToScreenPoint`）、调用 `runWindowsCapture`、把返回的 BGRA buffer 转成 `NativeImage`（`nativeImage.createFromBitmap`）、`tryWindowsGraphicsCapture` 整体包 try/catch 确保任何失败都能干净回退到 `desktopCapturer`（commit `303ae76`）

**注意：Step 4 手测尚未做完就已经合并进 main**（用户明确决定：单人项目，先合并，测试之后慢慢补。不代表功能已完全验证过，回头看这份文档时留意这一点）。

- [x] 已验证：`npm run dev` 端到端跑通，overlay 正常、取色正常、fallback 未触发（WGC 路径一直成功）；耗时约 300-450ms（比 `desktopCapturer` 的 500-780ms 快，但没到 ~100ms 目标——大头卡在每次 spawn 新进程 + WGC session 冷启动，若要进一步压缩耗时需要常驻 helper 之类的更大架构改动，不在这次范围内）；黄色边框确认会闪一下（`Default` 设置下的预期行为）
- [x] 已验证：纯红 `#FF0000` 通道测试（BGRA/RGBA 没搞反，`nativeImage.createFromBitmap` 按 BGRA 解析是对的）
- [ ] 待手测：多显示器（副屏 rect 匹配是否准确）——用户当前没有多屏测试条件，暂不测，影响判断为低优先级
- [x] 已验证：改名 exe 模拟崩溃，fallback 到 `desktopCapturer` 的路径完整可用，exe 改回来后下次取色能自动重新拉起
- [x] **Step 4** 全流程手测（多显示器除外，见上）

---

## 常驻 helper 优化（在上面 WGC 功能已合并 main 的基础上）

### 背景

Step 4 手测验证 WGC 端到端可用之后，实测耗时约 300-450ms，没到 ~100ms 目标。用加了临时计时日志的诊断分支（`debug/wgc-timing-and-fixes`，已删除，两个顺手修的 bug 走 PR #19 合并了）拆解耗时，发现单是"建 D3D 设备"这一步，在一台 4K 显示器机器上稳定花费 ~500ms（三次实测 491-503ms，波动 <3%），占总耗时近 80%，且**完全不会因为同一次 `npm run dev` 里连续截图而变快**——因为每次取色都是重新 spawn 一个全新进程、从零建一个全新 D3D 设备。

结论：真正的瓶颈不是"截图会话"或"等画面"，是"建显卡设备"这一步，且是进程级、不缓存的固定成本。治本办法：让 helper 进程常驻、D3D 设备只建一次、后续取色复用同一个设备。

### 这次工作方式的例外

用户明确说"这次你来做，我帮你测试，你来操刀"——跟本文档"协作方式"那节描述的"新手结对编程、Claude 只解释不动手"不一样，是针对这一个优化任务的例外，其余 Rust/native 工作默认还是按结对编程来。

### 架构改动

- **Rust 侧**（`native/windows-capture-helper/src/main.rs`）：从"一次性进程，跑完一帧就退出"改成"常驻进程"——`WinRT` 初始化、dispatcher queue、D3D 设备只在 `main()` 顶部建一次，之后在一个循环里反复从 stdin 读一行请求（格式不变，还是 `x y width height cursorX cursorY`，只是从 argv 搬到了 stdin，一行一个请求）、截一帧、按原来的二进制协议写回 stdout，直到 stdin 关闭（app 退出时）才退出。不能再用 crate 自带的 `GraphicsCaptureApiHandler::start()`（它会自己重新建一次设备），改成直接调 crate 暴露的底层公开函数（`create_d3d_device()`、`GraphicsCaptureApi::new()`、`stop_capture()`）自己攒了一个更小的循环，`WinRT` 初始化那部分 crate 里是私有的，抄了一份等价实现。用到的额外 crate：`parking_lot`（跟 `windows-capture` 内部用的 `Mutex<T>` 类型对齐，版本让 Cargo 自动解析到跟内部一致的 0.12.5）。
- **Node 侧**（`src/main/windowsCapture.ts` + `src/main/index.ts`）：新增 `WindowsCaptureSession` 类替代原来一次性的 `runWindowsCapture()` 函数，管理常驻进程的生命周期——懒加载 spawn（第一次取色才拉起）、写请求到 stdin、等一帧、超时（2 秒）/崩溃自动清理状态、下次 `capture()` 调用自动重新拉起。`app.on('will-quit', ...)` 里调用 `wgcSession.dispose()`，关 stdin 让 helper 看到 EOF 自己退出，超时强杀兜底，避免孤儿进程。

### 踩过的坑

- **stderr 日志错误路由到旧的 `log` 闭包**：`ensureChild()` 只在真正 spawn 新进程时才会执行，`child.stderr.on('data', ...)` 只在那一刻绑定一次；但这个绑定捕获的是当时那次 `capture()` 调用传进来的 `log` 函数（带着那次调用的 `captureStartedAt` 时间戳）。第二次及以后的 `capture()` 调用里 `ensureChild()` 直接复用已有进程、不会重新绑定，导致所有后续的 stderr 日志永远显示"距离第一次取色过了多久"，报出过 51524ms 这种吓人数字（其实只是两次取色之间用户操作间隔了 51 秒，跟性能无关）。修法：把"当前该用哪个 log 函数"存成一个每次 `capture()` 调用都会刷新的字段（`currentLog`），事件回调里读这个字段的最新值，不读闭包捕获的旧值。
- **陈旧帧（stale frame）**：常驰后 D3D 设备被反复复用来开新的截图会话，实测发现从第二次取色开始，**每次必现**——取色画面里会带着上一次设置窗口还没隐藏时的旧内容，只跳过第一帧不够解决。最终方案：`SingleFrameCapture::on_frame_arrived` 里改成按时间跳而不是按帧数跳——会话建好后头 150ms 内到的帧一律丢弃，只用 150ms 之后第一个到的帧（`STALE_FRAME_FLUSH_WINDOW`）。这个策略解决了问题，但 150ms 是拍的一个偏保守的数字，没有针对"最小需要多久"做过细调；单次取色耗时因此从"设备复用后 ~60-120ms"涨到"~200-230ms"，仍然远快于最初的 300-450ms，只是没打平"跳过陈旧帧"这个新成本之前测出的乐观数字。**没有查清楚陈旧帧的根本机制**（怀疑是同一个 D3D 设备上连续开关截图会话导致 GPU 纹理复用/没冲刷干净，但没有实锤），只是找到了一个实测有效的规避办法，回头如果要把 150ms 往下调，得重新理解这个机制而不是瞎调数字。

### 当前状态（2026-07-18）

- [x] 常驻进程 + D3D 设备复用架构实现完成，分支 `feature/wgc-persistent-helper`（未合并 main、未开 PR）
- [x] 陈旧帧 bug 定位 + 修复（150ms 时间窗）
- [x] 用户主力机（非 LG 那台）上手测：颜色正确、耗时稳定在 ~217-232ms、改名 exe 模拟崩溃 fallback 正常、app 退出后 helper 进程无孤儿残留
- [ ] 多显示器手测（当前没有测试条件，暂缓）
- [ ] LG 电脑回归测（之前在这台机器上单独测出过"建 D3D 设备"耗时 ~500ms、以及这次改动前的旧版本代码问题，值得单独确认新架构在这台机器上表现——尤其是 150ms 冲刷窗口是否同样够用）
- [ ] 150ms 冲刷窗口是否可以调小，需要先搞清楚陈旧帧的根本机制再调，不是这次任务的必须项
- [ ] 分支尚未合并 main，等用户明确同意

### 协作方式（这个工作流专属，其他任务不一定适用）

用户是 Rust 新手、TypeScript/Electron 老手，这部分工作按"新手结对编程"来：解释思路 + 给代码 + 说明验证方法，让用户自己敲/跑，报错先解释再改；不要在没被要求的情况下直接改这个工作流下的文件（除非用户明确说"你帮我做/改"）。Rust 部分的解释要比 TS 部分更耐心、更口语化，避免术语堆砌（用户明确反馈过"像看天书"）。涉及 Windows 原生 API 的具体函数签名/字段名，写代码前先去核实真实源码（`docs.rs` 摘要曾经给错过名字），不要凭记忆/摘要瞎写。
