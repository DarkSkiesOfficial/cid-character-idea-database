import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { loadOrCreateRegistry } from './handlers/library-handlers'
import { getAppRoot } from './paths'

// Default data dir used for first-run and fallback
const DEFAULT_DATA_DIR = join(getAppRoot(), 'data')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#121416',
    title: 'Character Idea Database',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', true)
  })
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.character-idea-database')

  // Register protocol for serving local images
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    if (!existsSync(filePath)) {
      return new Response('File not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Load library registry and init the active library's database
  try {
    const registry = loadOrCreateRegistry(DEFAULT_DATA_DIR)
    const activeLib = registry.libraries.find(l => l.id === registry.activeLibraryId) || registry.libraries[0]
    initDatabase(activeLib.path)
    registerIpcHandlers()
  } catch (err) {
    console.error('Failed to initialize application:', err)
    dialog.showErrorBox('Startup Error', `Failed to initialize:\n${err instanceof Error ? err.message : String(err)}`)
    app.quit()
    return
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((err) => {
  console.error('app.whenReady() failed:', err)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
