import { join } from 'path'
import { spawn } from 'child_process'

const WGC_CAPTURE_TIMEOUT_MS = 2000 // 硬超时，防止 helper 卡死一直转圈

// spawn helper、拼帧、超时/失败都 resolve null（让调用方走 fallback），不 reject
export function runWindowsCapture(
    helperPath: string,
    log: (message: string) => void = () => {}
): Promise<WindowsCaptureFrame | null> {
    return new Promise((resolve) => {
        let settled = false
        // 防止拿到完整帧之后，进程的 close/error 事件又重复 resolve 一次
        const finish = (result: WindowsCaptureFrame | null): void => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timeoutHandle)
            resolve(result)
        }

        log('before spawn')
        const child = spawn(helperPath, [], { stdio: ['ignore', 'pipe', 'pipe']})

        const timeoutHandle = setTimeout(() => {
            log('time out, killing helper')
            child.kill()
            finish(null)
        }, WGC_CAPTURE_TIMEOUT_MS)

        const assembler = new WgcFrameAssembler()
        let headerLogged = false // 只打一次"收到 header"的日志

        child.stdout.on('data', (chunk: Buffer) => {
            assembler.push(chunk)

            if (!headerLogged && assembler.hasHeader()) {
                headerLogged = true
                log('header received')
            }

            if (assembler.isComplete()) {
                const frame = assembler.getFrame()
                log(`payload received size=${frame.payload.length}`)
                finish(frame)
            }
        })

        // helper 自己的日志，转发进主进程日志流，加 [wgc] 前缀区分
        child.stderr.setEncoding('utf8')
        child.stderr.on('data', (chunk: string) => {
            for (const line of chunk.split('\n')) {
                const trimmed = line.trim()
                if (trimmed) {
                    log(`[wgc] ${trimmed}`)
                }
            }
        })

        // spawn 失败（比如 exe 不存在）
        child.once('error', (err) => {
            log(`helper process error: ${err.message}`)
            finish(null)
        })

        // 进程退出但还没拿到完整帧，说明中途崩了或异常退出
        child.once('close', (code) => {
            if (code !== 0) {
                log(`helper exited with code=${code}`)
            }
            finish(null)
        })
    })
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