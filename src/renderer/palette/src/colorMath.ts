export function hexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
  const parts = hex.replace('#', '').match(/.{2}/g)

  if (!parts) return
  const [r, g, b] = parts.map((input) => parseInt(input, 16))

  return { r, g, b }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => n.toString(16).padStart(2, '0')
  return ('#' + toHex(r) + toHex(g) + toHex(b)).toUpperCase()
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  let h: number = 0,
    s: number = 0
  r = r / 255
  g = g / 255
  b = b / 255

  const max: number = Math.max(r, g, b)
  const min: number = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6

    h = h * 360
  }

  return { h, s, l }
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number = 0,
    g: number = 0,
    b: number = 0
  h = h / 360

  if (s === 0) {
    r = g = b = l * 255
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    const hueToRgb = (t: number): number => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    r = Math.round(hueToRgb(h + 1 / 3) * 255)
    g = Math.round(hueToRgb(h) * 255)
    b = Math.round(hueToRgb(h - 1 / 3) * 255)
  }
  return { r, g, b }
}

export function rgbToCmyk(
  r: number,
  g: number,
  b: number
): { c: number; m: number; y: number; k: number } {
  const rN = r / 255
  const gN = g / 255
  const bN = b / 255

  let c: number, m: number, y: number
  let k = 1 - Math.max(rN, gN, bN)

  if (k === 1) {
    c = m = y = 0
    k = 100
  } else {
    c = Math.round(((1 - rN - k) / (1 - k)) * 100)
    m = Math.round(((1 - gN - k) / (1 - k)) * 100)
    y = Math.round(((1 - bN - k) / (1 - k)) * 100)
    k = Math.round(k * 100)
  }
  return { c, m, y, k }
}

export function generatePalette(hex: string, count: number): Palette {
  const rgb = hexToRgb(hex)
  if (!rgb) throw new Error(`Invalid hex: ${hex}`)
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const lighter: string[] = []
  const darker: string[] = []

  const half = count / 2

  for (let i = 0; i < half; i++) {
    const t = (i + 1) / half
    const lighterL = hsl.l + (1 - hsl.l) * t
    const lighterRgb = hslToRgb(hsl.h, hsl.s, lighterL)
    lighter.push(rgbToHex(lighterRgb.r, lighterRgb.g, lighterRgb.b))

    const darkerL = hsl.l - hsl.l * t
    const darkerRgb = hslToRgb(hsl.h, hsl.s, darkerL)
    darker.push(rgbToHex(darkerRgb.r, darkerRgb.g, darkerRgb.b))
  }

  return { center: hex.toUpperCase(), lighter, darker }
}

export interface Palette {
  center: string
  lighter: string[]
  darker: string[]
}
