import { describe, expect, it, vi } from 'vitest'
import { blurFocusedElement } from './focus'

describe('blurFocusedElement', () => {
  it('blurs the current focused element when it can be blurred', () => {
    const blur = vi.fn<() => void>()

    blurFocusedElement({ blur } as unknown as Element)

    expect(blur).toHaveBeenCalledOnce()
  })

  it('does nothing when there is no focused element', () => {
    expect(() => blurFocusedElement(null)).not.toThrow()
  })
})
