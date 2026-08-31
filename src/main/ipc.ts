import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { addRootPath, listRoots, removeRoot, renameRoot } from './roots'

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

  ipcMain.handle('shell:reveal', (_e, path: string) => {
    shell.showItemInFolder(path)
  })
}
