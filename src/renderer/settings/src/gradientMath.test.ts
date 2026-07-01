import { describe, expect, it } from 'vitest'
import { generateGradient } from './gradientMath'

describe('generateGradient', () => {
  it('returns the requested number of colours', () => {
    expect(generateGradient('#000000', '#FFFFFF', 4)).toHaveLength(4)
    expect(generateGradient('#000000', '#FFFFFF', 9)).toHaveLength(9)
    expect(generateGradient('#000000', '#FFFFFF', 16)).toHaveLength(16)
  })

  it('keeps Colour A as the first colour and Colour B as the last colour', () => {
    const amounts = [4, 9, 16] as const

    for (const amount of amounts) {
      const colours = generateGradient('#FCA88F', '#FFFFFF', amount)
      expect(colours[0]).toBe('#FCA88F')
      expect(colours[colours.length - 1]).toBe('#FFFFFF')
    }
  })

  it('interpolates colours between black and white', () => {
    expect(generateGradient('#000000', '#FFFFFF', 4)).toEqual([
      '#000000',
      '#555555',
      '#AAAAAA',
      '#FFFFFF'
    ])
  })
})
