import { join } from 'path'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'

const WGC_REQUEST_TIMEOUT_MS = 2000 // 每次取色请求的硬超时（含"进程刚拉起、正在建 D3D 设备"的那次），超时就当这次失败，触发 fallback

type PendingRequest = {
  assembler: WgcFrameAssembler
  resolve: (frame: WindowsCaptureFrame | null) => void
  timeoutHandle: NodeJS.Timeout
}

// 常驻的 WGC helper 进程封装：进程（以及它里面的 D3D 设备）只建一次，
// 之后每次取色只是往 stdin 写一行请求、等 stdout 吐一帧回来，省掉重新 spawn 一个新进程 + 重新建 D3D 设备的开销
// （实测建设备这一步单独可能要 ~500ms，是之前每次取色最大的固定成本）。
// 进程崩溃/超时会被当场清掉并把当前请求 resolve null（让调用方走 fallback），下一次 capture() 调用会自动重新拉起。
export class WindowsCaptureSession {
  private child: ChildProcessWithoutNullStreams | null = null
  private pending: PendingRequest | null = null
  private expectingExit = false

  constructor(private readonly helperPath: string) {}

  capture(
    target: WindowsCaptureTarget,
    log: (message: string) => void = () => {}
  ): Promise<WindowsCaptureFrame | null> {
    if (this.pending) {
      log('capture() called while a request is already in flight, ignoring')
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      let child: ChildProcessWithoutNullStreams
      try {
        child = this.ensureChild(log)
      } catch (err) {
        log(`failed to spawn helper: ${err}`)
        resolve(null)
        return
      }

      const timeoutHandle = setTimeout(() => {
        log('request timed out, killing helper')
        this.pending = null
        this.killChild()
        resolve(null)
      }, WGC_REQUEST_TIMEOUT_MS)

      this.pending = { assembler: new WgcFrameAssembler(), resolve, timeoutHandle }

      const line = buildWindowsCaptureRequestLine(target)
      child.stdin.write(`${line}\n`, (err) => {
        if (err) {
          log(`failed to write request: ${err.message}`)
          this.finishPending(null)
        }
      })
    })
  }

  // app 退出时调用：关 stdin 让 helper 看到 EOF 自己干净退出，一小段时间没退就强杀
  dispose(): void {
    const child = this.child
    if (!child) {
      return
    }

    this.expectingExit = true
    this.child = null
    this.finishPending(null)

    child.stdin.end()
    const forceKillHandle = setTimeout(() => child.kill(), 500)
    child.once('close', () => clearTimeout(forceKillHandle))
  }

  private ensureChild(log: (message: string) => void): ChildProcessWithoutNullStreams {
    if (this.child) {
      return this.child
    }

    log('spawning persistent helper')
    const child = spawn(this.helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child
    this.expectingExit = false

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      for (const trimmed of chunk.split('\n').map((line) => line.trim())) {
        if (trimmed) {
          log(`[wgc] ${trimmed}`)
        }
      }
    })

    child.stdout.on('data', (chunk: Buffer) => {
      const pending = this.pending
      if (!pending) {
        return
      }

      pending.assembler.push(chunk)
      if (pending.assembler.isComplete()) {
        this.finishPending(pending.assembler.getFrame())
      }
    })

    child.once('error', (err) => {
      log(`helper process error: ${err.message}`)
      this.handleChildGone()
    })

    child.once('close', (code) => {
      if (!this.expectingExit) {
        log(`helper exited unexpectedly with code=${code}`)
      }
      this.handleChildGone()
    })

    return child
  }

  private finishPending(frame: WindowsCaptureFrame | null): void {
    const pending = this.pending
    if (!pending) {
      return
    }
    this.pending = null
    clearTimeout(pending.timeoutHandle)
    pending.resolve(frame)
  }

  private handleChildGone(): void {
    this.child = null
    this.finishPending(null)
  }

  private killChild(): void {
    const child = this.child
    this.child = null
    child?.kill()
  }
}

export type WindowsCaptureFrame = {
  header: WgcFrameHeader
  payload: Buffer
}

export type WindowsCaptureHelperPathOptions = {
  isPackaged: boolean
  appPath: string
  resourcesPath: string
}

export function resolveWindowsCaptureHelperPath({
  isPackaged,
  appPath,
  resourcesPath
}: WindowsCaptureHelperPathOptions): string {
  if (isPackaged) {
    return join(resourcesPath, 'win', 'snidge-wgc-capture.exe')
  }
  return join(appPath, 'resources', 'win', 'snidge-wgc-capture.exe')
}

export const WGC_MAGIC = 'SNWG'

export type WgcFrameHeader = {
  version: number
  headerLen: number
  width: number
  height: number
  stride: number
  format: number
  dataLen: number
}

export function readWgcHeaderLen(prefix: Buffer): number {
  const magic = prefix.toString('ascii', 0, 4)
  if (magic !== WGC_MAGIC) {
    throw new Error(`unexpected WGC magic: ${magic}`)
  }

  return prefix.readUInt16LE(6)
}

export function parseWgcHeader(header: Buffer): WgcFrameHeader {
  return {
    version: header.readUInt16LE(4),
    headerLen: header.readUInt16LE(6),
    width: header.readUInt32LE(8),
    height: header.readUInt32LE(12),
    stride: header.readUInt32LE(16),
    format: header.readUInt32LE(20),
    dataLen: Number(header.readBigUInt64LE(24))
  }
}

// 把 stdout 陆续收到的小块数据，拼成一个完整的 frame
export class WgcFrameAssembler {
  private headerChunks: Buffer[] = []
  private headerBytesReceived = 0
  private header: WgcFrameHeader | null = null // 解析出来之前是 null
  private payload: Buffer | null = null // 知道 dataLen 后一次性分配好
  private payloadBytesReceived = 0

  // 每收到一块 stdout 数据就调用一次
  push(chunk: Buffer): void {
    if (!this.header) {
      chunk = this.feedHeaderBytes(chunk) // 剩余字节（如果有）是 payload
    }

    if (!this.header || chunk.length === 0) {
      return
    }

    this.feedPayloadBytes(chunk)
  }

  // 攒够 header 字节就解析，返回 chunk 里多出来的 payload 字节
  private feedHeaderBytes(chunk: Buffer): Buffer {
    this.headerChunks.push(chunk)
    this.headerBytesReceived += chunk.length

    if (this.headerBytesReceived < 8) {
      return Buffer.alloc(0)
    }

    const buffered = Buffer.concat(this.headerChunks)
    const headerLen = readWgcHeaderLen(buffered)

    if (buffered.length < headerLen) {
      return Buffer.alloc(0)
    }

    this.header = parseWgcHeader(buffered)
    this.payload = Buffer.alloc(this.header.dataLen)

    return buffered.subarray(headerLen)
  }

  // 把这块数据拷进 payload 对应的位置
  private feedPayloadBytes(chunk: Buffer): void {
    if (!this.payload) {
      throw new Error('feedPayloadBytes called before header was parsed')
    }

    chunk.copy(this.payload, this.payloadBytesReceived)
    this.payloadBytesReceived += chunk.length
  }

  // header 是否已经解析出来（用于只打一次日志）
  hasHeader(): boolean {
    return this.header !== null
  }

  // payload 是否已经收完整
  isComplete(): boolean {
    return this.payload !== null && this.payloadBytesReceived === this.payload.length
  }

  // 拿到完整的 header + payload，没收完整就抛错
  getFrame(): { header: WgcFrameHeader; payload: Buffer } {
    if (!this.header || !this.payload || !this.isComplete()) {
      throw new Error('frame is not complete yet')
    }

    return { header: this.header, payload: this.payload }
  }
}

export type WindowsCaptureTarget = {
  rect: { x: number; y: number; width: number; height: number }
  cursor: { x: number; y: number }
}

// 拼成 stdin 一行请求的格式："x y width height cursorX cursorY"（不含换行符，写的人自己加）
export function buildWindowsCaptureRequestLine(target: WindowsCaptureTarget): string {
  return [
    target.rect.x,
    target.rect.y,
    target.rect.width,
    target.rect.height,
    target.cursor.x,
    target.cursor.y
  ]
    .map((value) => String(Math.round(value)))
    .join(' ')
}
