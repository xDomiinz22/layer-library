import { BrowserWindow } from 'electron'
import type { ScanProgress } from '../shared/types'

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

export function emitScanProgress(p: ScanProgress): void {
  broadcast('scan:progress', p)
}

let libraryChangedTimer: NodeJS.Timeout | null = null
/** Coalesce de notificaciones de cambio de biblioteca. */
export function emitLibraryChanged(): void {
  if (libraryChangedTimer) return
  libraryChangedTimer = setTimeout(() => {
    libraryChangedTimer = null
    broadcast('library:changed')
  }, 250)
}
