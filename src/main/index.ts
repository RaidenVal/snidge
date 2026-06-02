import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  globalShortcut,
  desktopCapturer,
  screen,
  dialog
} from 'electron'
import type { Display, NativeImage } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import trayIcon from '../../resources/tray-icon.png?asset'
import store from './store'
import { join } from 'path'
import { writeFile } from 'fs/promises'

let tray: Tray | null = null
let settingsWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let paletteWindow: BrowserWindow | null = null
let lastScreenshot: NativeImage | null = null
let lastPickedColor: string | null = null

function createSettingsWindow(): void {
  // If settings window already exists, focus on it instead of
  // Opening a new one
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  // Create settings window ui
  settingsWindow = new BrowserWindow({
    show: false,
    frame: false,
    width: 600,
    height: 350,
    title: 'Preference',
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
    settingsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // When it is the production/live environment, load html file
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'))
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
    overlayWindow.focus()
    return
  }

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
    overlayWindow?.show()
    if (process.platform === 'win32') {
      overlayWindow?.setFullScreen(true)
    }
    overlayWindow?.focus()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // When it is the local/dev environment, load the url (localhost: xxxx)
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`)
  } else {
    // When it is the production/live environment, load html file
    overlayWindow.loadFile(join(__dirname, '../renderer/overlay.html'))
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

function createPaletteWindow(): void {
  // If paletteWindow already exists, focus on it instead of
  // Opening a new one
  if (paletteWindow && !paletteWindow.isDestroyed()) {
    paletteWindow.focus()
    return
  }

  // Create paletteWindow ui
  paletteWindow = new BrowserWindow({
    frame: false,
    width: 720,
    height: 460,
    title: 'Palette',
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // When it is the local/dev environment, load the url (localhost: xxxx)
    paletteWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/palette/index.html`)
  } else {
    // When it is the production/live environment, load html file
    paletteWindow.loadFile(join(__dirname, '../renderer/palette.html'))
  }

  // Clear the reference when the window is destroyed,
  // so the next createPaletteWindow() call creates a fresh one
  paletteWindow.on('closed', () => {
    paletteWindow = null
  })
}

async function triggerCapture(): Promise<void> {
  // Get the current location of the cursor
  const point = screen.getCursorScreenPoint()
  // Get the current display info
  // Uusers may have multiple displays)
  const display = screen.getDisplayNearestPoint(point)

  // Screenshot
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: display.size.width * display.scaleFactor,
      height: display.size.height * display.scaleFactor
    }
  })

  // Match and return the correct display with display_id
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]

  console.log('Captured: ', source.thumbnail.getSize())

  // Thumbnail means a small preview pic the user can identify
  // Here it means the pic itself
  lastScreenshot = source.thumbnail
  createOverlayWindow(display)
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
      click: () => createSettingsWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])
  tray.setContextMenu(contextMenu)

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
    return lastScreenshot?.toDataURL() ?? null
  })

  ipcMain.handle('get-picked-color', () => lastPickedColor)

  ipcMain.handle('save-palette', async (_event, dataURL: string) => {
    // 1. Pop the built-in save window from the operation system
    const result = await dialog.showSaveDialog({
      defaultPath: `palette-${Date.now()}.png`,
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

  ipcMain.on('close-settings-window', () => {
    settingsWindow?.close()
  })

  ipcMain.on('color-picked', (_event, hex: string) => {
    console.log('Color pick: ', hex)
    lastPickedColor = hex
    overlayWindow?.close()
    createPaletteWindow()
  })

  ipcMain.on('close-palette-window', () => {
    paletteWindow?.close()
  })

  ipcMain.on('repick', () => {
    if (paletteWindow) {
      // Listen first to make sure palette window is fully closed
      paletteWindow.once('closed', () => {
        setTimeout(() => triggerCapture(), 100)
      })
      paletteWindow.close()
    } else {
      triggerCapture()
    }
  })
})

app.on('window-all-closed', () => {
  // This can prevent the app from quiting when window close
})

// Clean the global shortcut when quiting the app
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
