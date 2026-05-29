import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getHotkey: (): Promise<string> => ipcRenderer.invoke('get-hotkey'),
  setHotkey: (newHotkey: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('set-hotkey', newHotkey),
  closeSettingsWindow: (): void => ipcRenderer.send('close-settings-window'),
  closePaletteWindow: (): void => ipcRenderer.send('close-palette-window'),
  pickColor: (hex: string): void => ipcRenderer.send('color-picked', hex),
  repick: (): void => ipcRenderer.send('repick'),
  getPickedColor: (): Promise<string | null> => ipcRenderer.invoke('get-picked-color'),
  getScreenshot: (): Promise<string | null> => ipcRenderer.invoke('get-screenshot')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
