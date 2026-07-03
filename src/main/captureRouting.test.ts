import { describe, expect, it } from 'vitest'
import { channelForCapturePurpose } from './captureRouting'

describe('channelForCapturePurpose', () => {
  it('routes palette captures to the palette picked-color channel', () => {
    expect(channelForCapturePurpose('palette')).toBe('palette-color-picked')
  })

  it('routes gradient captures to the gradient picked-color channel', () => {
    expect(channelForCapturePurpose('gradient')).toBe('gradient-color-picked')
  })
})
