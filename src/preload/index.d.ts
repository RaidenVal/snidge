import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getHotkey: () => Promise<string>
      setHotkey: (newHotkey: string) => Promise<{ success: boolean }>
      closeSettingsWindow: () => void
    }
  }
}
