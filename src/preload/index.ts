import { contextBridge, ipcRenderer } from 'electron'
import type { LayerApi, ScanProgress } from '../shared/types'

const api: LayerApi = {
  listRoots: () => ipcRenderer.invoke('roots:list'),
  addRoot: () => ipcRenderer.invoke('roots:add'),
  addRootPath: (path) => ipcRenderer.invoke('roots:addPath', path),
  removeRoot: (id) => ipcRenderer.invoke('roots:remove', id),
  renameRoot: (id, label) => ipcRenderer.invoke('roots:rename', id, label),
  rescanAll: () => ipcRenderer.invoke('scan:all'),
  rescanRoot: (id) => ipcRenderer.invoke('scan:root', id),
  getStats: () => ipcRenderer.invoke('stats:get'),
  listFiles: (opts) => ipcRenderer.invoke('files:list', opts),
  revealInExplorer: (path) => ipcRenderer.invoke('shell:reveal', path),
  appVersion: () => ipcRenderer.invoke('app:version'),
  onScanProgress: (cb: (p: ScanProgress) => void) => {
    const h = (_e: unknown, p: ScanProgress): void => cb(p)
    ipcRenderer.on('scan:progress', h)
    return () => ipcRenderer.removeListener('scan:progress', h)
  },
  onLibraryChanged: (cb: () => void) => {
    const h = (): void => cb()
    ipcRenderer.on('library:changed', h)
    return () => ipcRenderer.removeListener('library:changed', h)
  }
}

contextBridge.exposeInMainWorld('api', api)
