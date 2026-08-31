import { BrowserWindow, dialog, shell } from 'electron'
import { deleteFileByPath, getDb } from './db'
import { emitLibraryChanged } from './emit'

/**
 * Mueve archivos a la papelera del sistema tras confirmación explícita del usuario.
 * Devuelve cuántos se movieron.
 */
export async function trashFiles(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0

  const rows = getDb()
    .prepare(`SELECT id, path, name FROM files WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as unknown as { id: number; path: string; name: string }[]
  if (rows.length === 0) return 0

  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const detail =
    rows.length === 1
      ? rows[0].path
      : rows
          .slice(0, 8)
          .map((r) => `• ${r.name}`)
          .join('\n') + (rows.length > 8 ? `\n… y ${rows.length - 8} más` : '')

  const res = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Cancelar', 'Mover a la papelera'],
    defaultId: 1,
    cancelId: 0,
    title: 'Mover a la papelera',
    message:
      rows.length === 1
        ? `¿Mover “${rows[0].name}” a la papelera del sistema?`
        : `¿Mover ${rows.length} archivos a la papelera del sistema?`,
    detail
  })
  if (res.response !== 1) return 0

  let moved = 0
  for (const r of rows) {
    try {
      await shell.trashItem(r.path)
      deleteFileByPath(r.path)
      moved++
    } catch {
      /* archivo bloqueado o ya no existe */
    }
  }
  if (moved > 0) emitLibraryChanged()
  return moved
}
