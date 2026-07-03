type HideableWindow = {
  isDestroyed: () => boolean
  hide: () => void
}

export function hideWindow(window: HideableWindow | null): void {
  if (!window || window.isDestroyed()) {
    return
  }

  window.hide()
}
