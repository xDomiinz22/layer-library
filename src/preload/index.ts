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
  getStats: (rootId) => ipcRenderer.invoke('stats:get', rootId),
  listFiles: (opts) => ipcRenderer.invoke('files:list', opts),
  getFileDetail: (id) => ipcRenderer.invoke('files:detail', id),
  revealInExplorer: (path) => ipcRenderer.invoke('shell:reveal', path),
  openFile: (path) => ipcRenderer.invoke('shell:open', path),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  trashFiles: (ids) => ipcRenderer.invoke('files:trash', ids),

  listDuplicateGroups: () => ipcRenderer.invoke('dupes:list'),

  listCollections: () => ipcRenderer.invoke('collections:list'),
  createCollection: (name, kind) => ipcRenderer.invoke('collections:create', name, kind),
  renameCollection: (id, name) => ipcRenderer.invoke('collections:rename', id, name),
  deleteCollection: (id) => ipcRenderer.invoke('collections:delete', id),
  setFileCollection: (fileId, cid, member) =>
    ipcRenderer.invoke('collections:setFile', fileId, cid, member),
  listCollectionFiles: (cid) => ipcRenderer.invoke('collections:files', cid),

  listPrinters: () => ipcRenderer.invoke('printers:list'),
  createPrinter: (name) => ipcRenderer.invoke('printers:create', name),
  renamePrinter: (id, name) => ipcRenderer.invoke('printers:rename', id, name),
  deletePrinter: (id) => ipcRenderer.invoke('printers:delete', id),
  listQueue: () => ipcRenderer.invoke('queue:list'),
  addToQueue: (fileId, printerId) => ipcRenderer.invoke('queue:add', fileId, printerId),
  toggleQueue: (fileId) => ipcRenderer.invoke('queue:toggle', fileId),
  removeFromQueue: (itemId) => ipcRenderer.invoke('queue:remove', itemId),
  updateQueueItem: (itemId, patch) => ipcRenderer.invoke('queue:update', itemId, patch),
  moveQueueItem: (itemId, direction) => ipcRenderer.invoke('queue:move', itemId, direction),

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
