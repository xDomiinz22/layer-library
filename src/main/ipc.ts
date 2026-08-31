import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import type { CollectionKind, ListFilesOptions } from '../shared/types'
import { computeStats, getFileDetail, listFiles } from './db'
import { emitLibraryChanged } from './emit'
import { addRootPath, listRoots, removeRoot, renameRoot } from './roots'
import { scanAll, scanRoot } from './scanner'
import { listDuplicateGroups } from './dupes'
import { trashFiles } from './trash'
import {
  createCollection,
  deleteCollection,
  listCollectionFiles,
  listCollections,
  renameCollection,
  setFileCollection
} from './collections'
import {
  addToQueue,
  createPrinter,
  deletePrinter,
  listPrinters,
  listQueue,
  moveQueueItem,
  removeFromQueue,
  renamePrinter,
  toggleQueue,
  updateQueueItem
} from './queue'

export function registerIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('roots:list', () => listRoots())
  ipcMain.handle('roots:add', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const res = await dialog.showOpenDialog(win, {
      title: 'Elige una carpeta para la biblioteca',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return addRootPath(res.filePaths[0])
  })
  ipcMain.handle('roots:addPath', (_e, path: string) => addRootPath(path))
  ipcMain.handle('roots:remove', (_e, id: number) => removeRoot(id))
  ipcMain.handle('roots:rename', (_e, id: number, label: string) => renameRoot(id, label))

  ipcMain.handle('scan:all', () => {
    void scanAll()
  })
  ipcMain.handle('scan:root', (_e, id: number) => {
    void scanRoot(id)
  })

  ipcMain.handle('stats:get', () => computeStats())
  ipcMain.handle('files:list', (_e, opts: ListFilesOptions) => listFiles(opts ?? {}))
  ipcMain.handle('files:detail', (_e, id: number) => getFileDetail(id))
  ipcMain.handle('files:trash', (_e, ids: number[]) => trashFiles(ids))

  ipcMain.handle('dupes:list', () => listDuplicateGroups())

  /** Ejecuta una mutación y notifica a la UI para que refresque. */
  const mut = <T>(fn: () => T): T => {
    const r = fn()
    emitLibraryChanged()
    return r
  }

  ipcMain.handle('collections:list', () => listCollections())
  ipcMain.handle('collections:create', (_e, name: string, kind: CollectionKind) =>
    mut(() => createCollection(name, kind))
  )
  ipcMain.handle('collections:rename', (_e, id: number, name: string) =>
    mut(() => renameCollection(id, name))
  )
  ipcMain.handle('collections:delete', (_e, id: number) => mut(() => deleteCollection(id)))
  ipcMain.handle('collections:setFile', (_e, fileId: number, cid: number, member: boolean) =>
    mut(() => setFileCollection(fileId, cid, member))
  )
  ipcMain.handle('collections:files', (_e, cid: number) => listCollectionFiles(cid))

  ipcMain.handle('printers:list', () => listPrinters())
  ipcMain.handle('printers:create', (_e, name: string) => mut(() => createPrinter(name)))
  ipcMain.handle('printers:rename', (_e, id: number, name: string) =>
    mut(() => renamePrinter(id, name))
  )
  ipcMain.handle('printers:delete', (_e, id: number) => mut(() => deletePrinter(id)))

  ipcMain.handle('queue:list', () => listQueue())
  ipcMain.handle('queue:add', (_e, fileId: number, printerId: number | null) =>
    mut(() => addToQueue(fileId, printerId))
  )
  ipcMain.handle('queue:toggle', (_e, fileId: number) => mut(() => toggleQueue(fileId)))
  ipcMain.handle('queue:remove', (_e, itemId: number) => mut(() => removeFromQueue(itemId)))
  ipcMain.handle(
    'queue:update',
    (_e, itemId: number, patch: { printerId?: number | null; printed?: boolean }) =>
      mut(() => updateQueueItem(itemId, patch))
  )
  ipcMain.handle('queue:move', (_e, itemId: number, direction: 'up' | 'down') =>
    mut(() => moveQueueItem(itemId, direction))
  )

  ipcMain.handle('shell:reveal', (_e, path: string) => {
    shell.showItemInFolder(path)
  })
  ipcMain.handle('shell:open', async (_e, path: string) => {
    await shell.openPath(path)
  })
  ipcMain.handle('clipboard:write', (_e, text: string) => {
    clipboard.writeText(text)
  })
}
