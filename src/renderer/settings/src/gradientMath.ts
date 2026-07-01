import { hexToRgb, rgbToHex } from '../../palette/src/colorMath'

export type GradientToneAmount = 4 | 9 | 16

export function generateGradient(
  colourA: string,
  colourB: string,
  amount: GradientToneAmount
): string[] {
  const start = hexToRgb(colourA)
  const end = hexToRgb(colourB)

  if (!start || !end) {
    throw new Error(`Invalid gradient colours: ${colourA}, ${colourB}`)
  }

  return Array.from({ length: amount }, (_, index) => {
    const t = index / (amount - 1)

    const r = Math.round(start.r + (end.r - start.r) * t)
    const g = Math.round(start.g + (end.g - start.g) * t)
    const b = Math.round(start.b + (end.b - start.b) * t)

    return rgbToHex(r, g, b)
  })
}
