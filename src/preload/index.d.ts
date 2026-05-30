import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getHotkey: () => Promise<string>
      setHotkey: (newHotkey: string) => Promise<{ success: boolean }>
      closeSettingsWindow: () => void
      closePaletteWindow: () => void
      pickColor: (hex: string) => void
      repick: () => void
      getPickedColor: () => Promise<string | null>
      getScreenshot: () => Promise<string | null>
      savePalette: (
        dataURL: string
      ) => Promise<{ success: boolean; canceled?: boolean; path?: string }>
    }
  }
}
