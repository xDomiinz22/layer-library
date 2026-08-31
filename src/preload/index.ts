import { contextBridge, ipcRenderer } from 'electron'
import type { LayerApi } from '../shared/types'

const api: LayerApi = {
  listRoots: () => ipcRenderer.invoke('roots:list'),
  addRoot: () => ipcRenderer.invoke('roots:add'),
  addRootPath: (path) => ipcRenderer.invoke('roots:addPath', path),
  removeRoot: (id) => ipcRenderer.invoke('roots:remove', id),
  renameRoot: (id, label) => ipcRenderer.invoke('roots:rename', id, label),
  revealInExplorer: (path) => ipcRenderer.invoke('shell:reveal', path),
  appVersion: () => ipcRenderer.invoke('app:version')
}

contextBridge.exposeInMainWorld('api', api)
