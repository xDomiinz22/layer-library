import { contextBridge, ipcRenderer } from 'electron'
import type { ThumbJob, ThumberBridge } from '../shared/thumb'

const bridge: ThumberBridge = {
  ready: () => ipcRenderer.send('thumb:ready'),
  onJob: (cb) => {
    ipcRenderer.on('thumb:job', (_e, job: ThumbJob) => cb(job))
  },
  done: (id, pngBase64, meta) => ipcRenderer.send('thumb:done', { id, pngBase64, meta }),
  fail: (id, error) => ipcRenderer.send('thumb:fail', { id, error })
}

contextBridge.exposeInMainWorld('thumber', bridge)
