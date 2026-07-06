import { describe, expect, it, vi } from 'vitest'
import { hideWindow } from './windowActions'

describe('hideWindow', () => {
  it('hides an existing window', () => {
    const window = {
      isDestroyed: () => false,
      hide: vi.fn<() => void>()
    }

    hideWindow(window)

    expect(window.hide).toHaveBeenCalledOnce()
  })

  it('does nothing when the window is missing or destroyed', () => {
    const destroyedWindow = {
      isDestroyed: () => true,
      hide: vi.fn<() => void>()
    }

    expect(() => hideWindow(null)).not.toThrow()
    hideWindow(destroyedWindow)

    expect(destroyedWindow.hide).not.toHaveBeenCalled()
  })
})
