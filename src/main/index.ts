import { app, Menu, Tray, globalShortcut } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import trayIcon from '../../resources/tray-icon.png?asset'

let tray: Tray | null = null

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.raidenval.snidge')

  // Set up tray icon and menu behaviour
  tray = new Tray(trayIcon)
  // Show some text when hover over the tray icon
  tray.setToolTip('Snidge')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Hotkey Set up',
      click: () => {}
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])
  tray.setContextMenu(contextMenu)

  // Set up global shortcut
  const ret = globalShortcut.register('CommandOrControl+Shift+C', () => {
    console.log('Snidge triggered')
  })
  if (!ret) {
    console.log('Hotkey Command / Control + Shift + C is already in use')
  }
})

app.on('window-all-closed', () => {
  // This can prevent the app from quiting when window close
})

// Clean the global shortcut when quiting the app
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
