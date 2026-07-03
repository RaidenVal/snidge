export type ActiveTab = 'palette' | 'gradient' | 'settings'

const settingsTabs = new Set<string>(['palette', 'gradient', 'settings'])

export function isSettingsTab(value: string): value is ActiveTab {
  return settingsTabs.has(value)
}

export function initialSettingsTabFromLocation(location: Pick<Location, 'search'>): ActiveTab {
  const tab = new URLSearchParams(location.search).get('tab')

  if (tab && isSettingsTab(tab)) {
    return tab
  }

  return 'palette'
}
