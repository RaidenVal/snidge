import { describe, expect, it } from 'vitest'
import { initialSettingsTabFromLocation, isSettingsTab } from './settingsTabs'

describe('isSettingsTab', () => {
  it('accepts settings page tab names', () => {
    expect(isSettingsTab('palette')).toBe(true)
    expect(isSettingsTab('gradient')).toBe(true)
    expect(isSettingsTab('settings')).toBe(true)
  })

  it('rejects unknown tab names', () => {
    expect(isSettingsTab('preferences')).toBe(false)
  })
})

describe('initialSettingsTabFromLocation', () => {
  it('uses the tab query parameter when it is valid', () => {
    expect(initialSettingsTabFromLocation({ search: '?tab=settings' })).toBe('settings')
  })

  it('falls back to palette when the tab query parameter is missing or invalid', () => {
    expect(initialSettingsTabFromLocation({ search: '' })).toBe('palette')
    expect(initialSettingsTabFromLocation({ search: '?tab=preferences' })).toBe('palette')
  })
})
