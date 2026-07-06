type BlurrableElement = Element & {
  blur?: () => void
}

export function blurFocusedElement(activeElement: Element | null = document.activeElement): void {
  const blurrable = activeElement as BlurrableElement | null

  if (typeof blurrable?.blur === 'function') {
    blurrable.blur()
  }
}
