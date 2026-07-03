import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { IpcRendererEvent } from 'electron'

type Unsubscribe = () => void
type PickedColorChannel = 'palette-color-picked' | 'gradient-color-picked'
type SettingsTab = 'palette' | 'gradient' | 'settings'

function onPickedColor(channel: PickedColorChannel, callback: (hex: string) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, hex: string): void => {
    callback(hex)
  }

  ipcRenderer.on(channel, listener)

  return function unsubscribe(): void {
    ipcRenderer.removeListener(channel, listener)
  }
}

function onPaletteColorPicked(callback: (hex: string) => void): Unsubscribe {
  return onPickedColor('palette-color-picked', callback)
}

function onGradientColorPicked(callback: (hex: string) => void): Unsubscribe {
  return onPickedColor('gradient-color-picked', callback)
}

function onSettingsTabRequested(callback: (tab: SettingsTab) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, tab: SettingsTab): void => {
    callback(tab)
  }

  ipcRenderer.on('settings-tab-requested', listener)

  return function unsubscribe(): void {
    ipcRenderer.removeListener('settings-tab-requested', listener)
  }
}

// Custom APIs for renderer
const api = {
  getHotkey: (): Promise<string> => ipcRenderer.invoke('get-hotkey'),
  setHotkey: (newHotkey: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('set-hotkey', newHotkey),
  startCapture: (purpose: 'palette' | 'gradient'): void =>
    ipcRenderer.send('start-capture', purpose),
  onPaletteColorPicked,
  onGradientColorPicked,
  onSettingsTabRequested,
  closeSettingsWindow: (): void => ipcRenderer.send('close-settings-window'),
  closePaletteWindow: (): void => ipcRenderer.send('close-palette-window'),
  pickColor: (hex: string): void => ipcRenderer.send('color-picked', hex),
  repick: (): void => ipcRenderer.send('repick'),
  getPickedColor: (): Promise<string | null> => ipcRenderer.invoke('get-picked-color'),
  getScreenshot: (): Promise<string | null> => ipcRenderer.invoke('get-screenshot'),
  savePng: (
    dataURL: string,
    fileNamePrefix: string
  ): Promise<{ success: boolean; canceled?: boolean; path?: string }> =>
    ipcRenderer.invoke('save-png', dataURL, fileNamePrefix)
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
