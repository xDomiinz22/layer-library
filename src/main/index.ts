import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, nativeImage, net, protocol, shell } from 'electron'
import iconIco from '../../build/icon.ico?asset'
import iconPng from '../../build/icon.png?asset'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { scanAll } from './scanner'
import { pruneThumbnailCache, thumbFilePath } from './thumbnailer'
import { initUpdater } from './updater'
import { closeWatchers, syncWatchers } from './watcher'

const isDev = !app.isPackaged
const appIcon = nativeImage.createFromPath(process.platform === 'win32' ? iconIco : iconPng)

if (process.platform === 'win32') app.setAppUserModelId('app.layerlibrary.desktop')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'thumb',
    privileges: { standard: true, secure: true, supportFetchAPI: true }
  }
])

function registerThumbProtocol(): void {
  protocol.handle('thumb', async (request) => {
    let name: string
    try {
      name = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
    } catch {
      return new Response(null, { status: 400 })
    }
    const safe = basename(name)
    if (!/^[a-f0-9]{16,64}\.png$/i.test(safe)) return new Response(null, { status: 404 })
    return net.fetch(pathToFileURL(thumbFilePath(safe)).toString())
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#0b0f1a',
    show: false,
    autoHideMenuBar: true,
    title: 'Layer Library',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDb()
  registerThumbProtocol()
  registerIpc()
  // Antes que createWindow(): registra los handlers IPC de updater:* para
  // que existan ya cuando el renderer monte y pida el estado inicial
  // (UpdateFoot.tsx llama a getUpdateState() nada más montar).
  initUpdater()
  createWindow()

  // Indexado y vigilancia en segundo plano.
  void scanAll()
  void syncWatchers()
  // Limpieza de miniaturas huérfanas (sin bloquear el arranque).
  setTimeout(() => void pruneThumbnailCache(), 8000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  void closeWatchers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
