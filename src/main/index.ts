import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  globalShortcut,
  desktopCapturer,
  nativeImage,
  screen,
  dialog
} from 'electron'
import type { Display, NativeImage } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import trayIcon from '../../resources/tray-icon.png?asset'
import appIcon from '../../resources/icon.png?asset'
import store from './store'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import {
  channelForCapturePurpose,
  type CapturePurpose,
  type PickedColorChannel
} from './captureRouting'
import { resolveMacSamplerPath, runMacSampler } from './macosSampler'
import { hideWindow } from './windowActions'
import { resolveWindowsCaptureHelperPath, runWindowsCapture } from './windowsCapture'

type SettingsTab = 'palette' | 'gradient' | 'settings'

let tray: Tray | null = null
let settingsWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let lastScreenshot: NativeImage | null = null
let lastScreenshotSize: { width: number; height: number } | null = null
let lastPickedColor: string | null = null
let activeCaptureStartedAt: number | null = null
let capturePurpose: CapturePurpose = 'palette'

function logCapture(message: string, startedAt: number | null = activeCaptureStartedAt): void {
  if (!startedAt) {
    console.log(`[capture] ${message}`)
    return
  }

  console.log(`[capture] ${message} +${Date.now() - startedAt}ms`)
}

function requestSettingsTab(tab: SettingsTab): void {
  settingsWindow?.webContents.send('settings-tab-requested', tab)
}

function settingsWindowURL(tab?: SettingsTab): string {
  const baseURL = `${process.env['ELECTRON_RENDERER_URL']}/settings/index.html`
  if (!tab) {
    return baseURL
  }

  return `${baseURL}?tab=${encodeURIComponent(tab)}`
}

function createSettingsWindow(tab?: SettingsTab): void {
  // If settings window already exists, focus on it instead of
  // Opening a new one
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (!settingsWindow.isVisible()) {
      settingsWindow.show()
    }
    settingsWindow.focus()
    if (tab) {
      requestSettingsTab(tab)
    }
    return
  }

  // Create settings window ui
  settingsWindow = new BrowserWindow({
    show: false,
    frame: false,
    width: 860,
    height: 500,
    title: 'Snidge',
    icon: appIcon,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // When it is the local/dev environment, load the url (localhost: xxxx)
    settingsWindow.loadURL(settingsWindowURL(tab))
  } else {
    // When it is the production/live environment, load html file
    const loadOptions = tab ? { query: { tab } } : undefined
    settingsWindow.loadFile(join(__dirname, '../renderer/settings/index.html'), loadOptions)
  }

  // Clear the reference when the window is destroyed,
  // so the next createSettingsWindow() call creates a fresh one
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  // Add the f12 dev inspection function
  optimizer.watchWindowShortcuts(settingsWindow)
}

function createOverlayWindow(display: Display): void {
  // Check if overlayWindow already exits
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    logCapture('overlay already exists; focusing')
    overlayWindow.focus()
    return
  }

  logCapture('creating overlay window')
  overlayWindow = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: true,
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  overlayWindow.once('ready-to-show', () => {
    logCapture('overlay ready-to-show')
    overlayWindow?.show()
    if (process.platform === 'win32') {
      overlayWindow?.setFullScreen(true)
    }
    overlayWindow?.focus()
  })

  overlayWindow.webContents.once('did-finish-load', () => {
    logCapture('overlay did-finish-load')
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // When it is the local/dev environment, load the url (localhost: xxxx)
    logCapture('overlay loadURL requested')
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`)
  } else {
    // When it is the production/live environment, load html file
    logCapture('overlay loadFile requested')
    overlayWindow.loadFile(join(__dirname, '../renderer/overlay/index.html'))
  }

  // Clear the reference when the window is destroyed,
  // so the next createOverlayWindow() call creates a fresh one
  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  overlayWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      overlayWindow?.close()
    }
  })
}

function showSettingsWindow(): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    createSettingsWindow()
    return
  }

  settingsWindow.show()
  settingsWindow.focus()
}

function sendColorToSettings(channel: PickedColorChannel, hex: string): void {
  const sendColor = (): void => {
    settingsWindow?.show()
    settingsWindow?.focus()
    settingsWindow?.webContents.send(channel, hex)
  }

  if (!settingsWindow || settingsWindow.isDestroyed()) {
    createSettingsWindow()
    settingsWindow?.webContents.once('did-finish-load', sendColor)
    return
  }

  sendColor()
}

function handlePickedColor(hex: string): void {
  console.log('Color pick: ', hex)
  lastPickedColor = hex
  overlayWindow?.close()
  sendColorToSettings(channelForCapturePurpose(capturePurpose), hex)
}

async function triggerMacSystemCapture(startedAt: number): Promise<void> {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    logCapture('hiding window', startedAt)
    settingsWindow.hide()
  }

  const helperPath = resolveMacSamplerPath({
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath
  })

  try {
    logCapture(`before mac sampler path=${helperPath}`, startedAt)
    const hex = await runMacSampler(helperPath)
    if (!hex) {
      logCapture('mac sampler canceled', startedAt)
      showSettingsWindow()
      return
    }

    logCapture(`mac sampler picked ${hex}`, startedAt)
    handlePickedColor(hex)
  } catch (err) {
    console.error('macOS sampler failed:', err)
    showSettingsWindow()
  }
}

async function hideSettingsWindowForCapture(captureStartedAt: number): Promise<void> {
  const window = settingsWindow
  if (!window || window.isDestroyed() || !window.isVisible()) {
    return
  }

  logCapture('hiding window', captureStartedAt)

  await new Promise<void>((resolve) => {
    window.once('hide', () => resolve())
    window.hide()
  })

  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => setTimeout(resolve, 32))
  }

  logCapture('after hide settle', captureStartedAt)
}

async function tryWindowsGraphicsCapture(display: Display, captureStartedAt: number): Promise<boolean> {
  try {
    const helperPath = resolveWindowsCaptureHelperPath({
      isPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath
    })

    const rect = screen.dipToScreenRect(null, display.bounds)
    const cursor = screen.dipToScreenPoint(screen.getCursorScreenPoint())

    const frame = await runWindowsCapture(helperPath, { rect, cursor }, (message) => 
      logCapture(message, captureStartedAt)
    )

    if (!frame) {
      return false
    }

    lastScreenshot = nativeImage.createFromBitmap(frame.payload, {
      width: frame.header.width,
      height: frame.header.height
    })
    lastScreenshotSize = { width: frame.header.width, height: frame.header.height }
    logCapture(`after wgc screenshot image=${frame.header.width}x${frame.header.height}`, captureStartedAt)

    return true
  } catch (err) {
    logCapture(`wgc capture threw: ${err}`, captureStartedAt)
    return false
  }
}

async function triggerCapture(purpose: CapturePurpose = 'palette'): Promise<void> {
  const captureStartedAt = Date.now()
  activeCaptureStartedAt = captureStartedAt
  logCapture(`start purpose=${purpose} platform=${process.platform}`, captureStartedAt)
  capturePurpose = purpose
  lastScreenshot = null
  lastScreenshotSize = null

  if (process.platform === 'darwin') {
    await triggerMacSystemCapture(captureStartedAt)
    return
  }

  await hideSettingsWindowForCapture(captureStartedAt)

  const point = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(point)
  logCapture(
    `display id=${display.id} bounds=${display.bounds.x},${display.bounds.y} ${display.bounds.width}x${display.bounds.height} size=${display.size.width}x${display.size.height} scale=${display.scaleFactor}`,
    captureStartedAt
  )

  try {
    const wgcSucceed = await tryWindowsGraphicsCapture(display, captureStartedAt)

    if (!wgcSucceed) {
      logCapture('before screenshot', captureStartedAt)
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: display.size.width * display.scaleFactor,
          height: display.size.height * display.scaleFactor
        }
      })
      const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
      lastScreenshot = source.thumbnail
      lastScreenshotSize = source.thumbnail.getSize()
      const size = lastScreenshotSize
      logCapture(`after screenshot image=${size.width}x${size.height}`, captureStartedAt)
    }

    createOverlayWindow(display)
  } catch (err) {
    console.error('Capture failed:', err)
  }
}

app.whenReady().then(() => {
  console.log('Saved hotkey: ', store.get('hotkey'))
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.raidenval.snidge')

  // Set up tray icon and menu behaviour
  tray = new Tray(trayIcon)
  // Show some text when hover over the tray icon
  tray.setToolTip('Snidge')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Preferences',
      click: () => createSettingsWindow('settings')
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])

  tray.on('click', () => {
    createSettingsWindow()
  })

  tray.on('right-click', () => {
    tray?.popUpContextMenu(contextMenu)
  })

  // Hotkey registration
  const hotkey = store.get('hotkey')
  const ret = globalShortcut.register(hotkey, triggerCapture)

  if (!ret) {
    console.warn(`Hotkey ${hotkey} unavailable at startup`)
  }

  // Set up global shortcut
  // Set current hotkey
  ipcMain.handle('get-hotkey', () => store.get('hotkey'))

  // Set new hotkey
  ipcMain.handle('set-hotkey', (_event, newHotkey: string) => {
    const oldHotkey = store.get('hotkey')
    globalShortcut.unregisterAll()

    const success = globalShortcut.register(newHotkey, triggerCapture)

    if (success) {
      store.set('hotkey', newHotkey)
    } else {
      globalShortcut.register(oldHotkey, triggerCapture)
    }
    return { success }
  })

  ipcMain.handle('get-screenshot', () => {
    if (!lastScreenshot) return null
    const startedAt = Date.now()
    // Raw BGRA pixels; a memcpy instead of the ~700ms 4K PNG encode
    const buffer = lastScreenshot.toBitmap()
    const size = lastScreenshotSize ?? lastScreenshot.getSize()
    logCapture(`get-screenshot toBitmap elapsed=${Date.now() - startedAt}ms bytes=${buffer.length}`)
    return { buffer, width: size.width, height: size.height }
  })

  ipcMain.handle('get-picked-color', () => lastPickedColor)

  ipcMain.on('overlay-log', (_event, message: string) => {
    logCapture(`[overlay] ${message}`)
  })

  ipcMain.handle('save-png', async (_event, dataURL: string, fileNamePrefix: string) => {
    // 1. Pop the built-in save window from the operation system
    const result = await dialog.showSaveDialog({
      defaultPath: `${fileNamePrefix}-${Date.now()}.png`,
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })

    // 2. If users cancel the save process
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    // 3. base 64 -> buffer (which is 二进制)
    const base64 = dataURL.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')

    // 4. Generate the file
    await writeFile(result.filePath, buffer)

    return { success: true, path: result.filePath }
  })

  ipcMain.on('start-capture', (_event, purpose: CapturePurpose) => {
    triggerCapture(purpose)
  })

  ipcMain.on('close-settings-window', () => {
    hideWindow(settingsWindow)
  })

  ipcMain.on('color-picked', (_event, hex: string) => {
    handlePickedColor(hex)
  })

  ipcMain.on('close-palette-window', () => {
    hideWindow(settingsWindow)
  })

  ipcMain.on('repick', () => {
    triggerCapture()
  })
  createSettingsWindow()
})

app.on('window-all-closed', () => {
  // This can prevent the app from quiting when window close
})

// Clean the global shortcut when quiting the app
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
