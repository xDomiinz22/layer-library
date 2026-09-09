import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateInfo } from 'electron-updater'
import type { UpdateState } from '../shared/types'

const { autoUpdater } = electronUpdater

const SIX_HOURS = 6 * 60 * 60 * 1000

let state: UpdateState = { phase: 'idle' }

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('updater:state', state)
  }
}

function set(next: UpdateState): void {
  state = next
  broadcast()
}

/**
 * Auto-actualización contra las Releases de GitHub (xDomiinz22/layer-library).
 * Descarga en segundo plano; el usuario decide cuándo reiniciar. Si no
 * reinicia, se instala al cerrar la app. No hace nada en desarrollo.
 */
export function initUpdater(): void {
  // Los handlers se registran siempre, empaquetado o no — si no, en cuanto
  // el renderer llama a getUpdateState() (UpdateFoot.tsx, nada más montar)
  // revienta con "No handler registered for 'updater:get'": una promesa
  // rechazada sin capturar que ensucia la consola al lanzar la app sin
  // empaquetar (`electron-vite preview` / `npm start`). No pasa en la app
  // instalada de verdad (ahí `app.isPackaged` ya es `true`), pero tampoco
  // cuesta nada evitarlo también en desarrollo.
  ipcMain.handle('updater:get', () => state)
  ipcMain.handle('updater:check', () => {
    if (!app.isPackaged) return
    void autoUpdater.checkForUpdates().catch(() => {
      /* el evento 'error' ya informa */
    })
  })
  ipcMain.handle('updater:install', () => {
    if (state.phase === 'ready') {
      // isSilent=false para mostrar el instalador; isForceRunAfter=true reabre
      setImmediate(() => autoUpdater.quitAndInstall(false, true))
    }
  })

  // No comprueba actualizaciones en desarrollo — sin paquete no hay contra
  // qué comparar versión, y autoUpdater.checkForUpdates() fallaría solo.
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    if (state.phase === 'idle' || state.phase === 'error') set({ phase: 'checking' })
  })
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    set({ phase: 'downloading', version: info.version, percent: 0 })
  })
  autoUpdater.on('update-not-available', () => {
    set({ phase: 'idle' })
  })
  autoUpdater.on('download-progress', (p) => {
    set({ phase: 'downloading', version: state.version, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    set({ phase: 'ready', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    set({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
  })

  void autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => void autoUpdater.checkForUpdates().catch(() => {}), SIX_HOURS)
}
