import { describe, expect, it } from 'vitest'
import { parseSamplerOutput, resolveMacSamplerPath } from './macosSampler'

describe('parseSamplerOutput', () => {
  it('returns an uppercase HEX colour from sampler stdout', () => {
    expect(parseSamplerOutput('  #a1b2c3\n')).toBe('#A1B2C3')
  })

  it('returns null when sampler stdout does not contain a HEX colour', () => {
    expect(parseSamplerOutput('\n')).toBeNull()
  })
})

describe('resolveMacSamplerPath', () => {
  it('uses resourcesPath when the app is packaged', () => {
    expect(
      resolveMacSamplerPath({
        isPackaged: true,
        appPath: '/dev/app',
        resourcesPath: '/Applications/Snidge.app/Contents/Resources'
      })
    ).toBe('/Applications/Snidge.app/Contents/Resources/macos/snidge-sampler')
  })

  it('uses the repo resources directory during development', () => {
    expect(
      resolveMacSamplerPath({
        isPackaged: false,
        appPath: '/Users/jolene.zou/snidge',
        resourcesPath: '/unused'
      })
    ).toBe('/Users/jolene.zou/snidge/resources/macos/snidge-sampler')
  })
})
