import { describe, expect, it } from 'vitest'
import {
    WgcFrameAssembler,
    parseWgcHeader,
    readWgcHeaderLen,
    resolveWindowsCaptureHelperPath,
    buildWindowsCaptureArgs
} from './windowsCapture'

function buildFakeHeader(): Buffer {
    const header = Buffer.alloc(32)
    header.write('SNWG', 0, 'ascii')
    header.writeUInt16LE(1, 4) // version
    header.writeUInt16LE(32, 6) // headerLen
    header.writeUInt32LE(4, 8) // width
    header.writeUInt32LE(2, 12) // height
    header.writeUInt32LE(16, 16) // stride
    header.writeUInt32LE(1, 20) // format
    header.writeBigUInt64LE(32n, 24) // dataLen
    return header
}

describe('resolveWindowsCaptureHelperPath', () => {
    it('uses resourcesPath when the app is packaged', () => {
        expect(
            resolveWindowsCaptureHelperPath({
                isPackaged: true,
                appPath: 'C:\\dev\\app',
                resourcesPath: 'C:\\Program Files\\Snidge\\resources'
            })
        ).toBe('C:\\Program Files\\Snidge\\resources\\win\\snidge-wgc-capture.exe')
    })

    it('uses the repo resources directory during development', () => {
        expect(
            resolveWindowsCaptureHelperPath({
                isPackaged: false,
                appPath: 'E:\\Projects\\snidge',
                resourcesPath: 'unused'
            })
        ).toBe('E:\\Projects\\snidge\\resources\\win\\snidge-wgc-capture.exe')
    })
})

describe('readWgcHeaderLen', () => {
    it('reads the declared header length', () => {
        expect(readWgcHeaderLen(buildFakeHeader())).toBe(32)
    })

    it('throws when the magic bytes do not match', () => {
        const bad = Buffer.alloc(8)
        bad.write('XXXX', 0, 'ascii')
        expect(() => readWgcHeaderLen(bad)).toThrow('unexpected WGC magic')
    })
})

describe('parseWgcHeader', () => {
    it('parses all fields from a well-formed header', () => {
        expect(parseWgcHeader(buildFakeHeader())).toEqual({
            version: 1,
            headerLen: 32,
            width: 4,
            height: 2,
            stride: 16,
            format: 1,
            dataLen: 32
        })
    })
})

function buildFakeHeaderWithDataLen(dataLen: number): Buffer {
    const header = buildFakeHeader()
    header.writeUInt32LE(dataLen, 16) // stride，这里不重要，随便填
    header.writeBigUInt64LE(BigInt(dataLen), 24)
    return header
}

describe('WgcFrameAssembler', () => {
    it('assembles a frame delivered in a single chunk', () => {
        const payload = Buffer.from([10, 20, 30, 40, 50, 60, 70, 80])
        const frame = Buffer.concat([buildFakeHeaderWithDataLen(payload.length), payload])

        const assembler = new WgcFrameAssembler()
        assembler.push(frame)

        expect(assembler.isComplete()).toBe(true)
        expect(assembler.getFrame().payload).toEqual(payload)
    })

    it('assembles a frame delivered in many small, arbitrarily split chunks', () => {
        const payload = Buffer.from([10, 20, 30, 40, 50, 60, 70, 80])
        const frame = Buffer.concat([buildFakeHeaderWithDataLen(payload.length), payload])

        const assembler = new WgcFrameAssembler()
        for (let i = 0; i < frame.length; i += 3) {
            assembler.push(frame.subarray(i, i + 3))
        }

        expect(assembler.isComplete()).toBe(true)
        expect(assembler.getFrame().payload).toEqual(payload)
    })

    it('is not complete until all payload bytes arrive', () => {
        const payload = Buffer.from([10, 20, 30, 40])
        const frame = Buffer.concat([buildFakeHeaderWithDataLen(payload.length), payload])

        const assembler = new WgcFrameAssembler()
        assembler.push(frame.subarray(0, frame.length - 1))

        expect(assembler.isComplete()).toBe(false)
    })
})

describe('buildWindowsCaptureArgs', () => {
    it('converts rect + cursor into positional string args', () => {
        expect(
            buildWindowsCaptureArgs({
                rect: { x: 0, y: 0, width: 3440, height: 1440 },
                cursor: { x: 100, y: 200 }
            })
        ).toEqual(['0', '0', '3440', '1440', '100', '200'])
    })

    it('rounds fractional pixel values', () => {
        expect(
            buildWindowsCaptureArgs({
                rect: { x: -1920.4, y: 0.6, width: 1920, height: 1080 },
                cursor: { x: 100.5, y: 100.5 }
            })
        ).toEqual(['-1920', '1', '1920', '1080', '101', '101'])
    })
})