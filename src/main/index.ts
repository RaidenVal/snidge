import { app, BrowserWindow, ipcMain, Menu, Tray, globalShortcut } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import trayIcon from '../../resources/tray-icon.png?asset'
import store from './store'
import { join } from 'path'

let tray: Tray | null = null
let settingsWindow: BrowserWindow | null = null

function createSettingsWindow(): void {
  // If settings window already exists, focus on it instead of
  // Opening a new one
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  // Create settings window ui
  settingsWindow = new BrowserWindow({
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

function triggerCapture(): void {
  console.log('Snidge triggered')
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

  ipcMain.on('close-settings-window', () => {
    settingsWindow?.close()
  })
})

app.on('window-all-closed', () => {
  // This can prevent the app from quiting when window close
})

// Clean the global shortcut when quiting the app
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
