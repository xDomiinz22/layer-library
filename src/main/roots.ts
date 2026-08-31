import { access, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { LibraryRoot, RootKind } from '../shared/types'
import {
  countFilesByRoot,
  deleteRoot,
  insertRoot,
  rowToRoot,
  selectRootRow,
  selectRootRows,
  updateRootLabel
} from './db'

/** Heurística de tipo de raíz a partir de la ruta. */
function classifyPath(p: string): RootKind {
  if (p.startsWith('\\\\') || p.startsWith('//')) return 'network'
  const drive = /^([A-Za-z]):[\\/]/.exec(p)?.[1]?.toUpperCase()
  // C: se asume disco del sistema; el resto de letras, unidad potencialmente extraíble.
  if (drive && drive !== 'C') return 'external'
  return 'local'
}

async function isOnline(p: string): Promise<boolean> {
  try {
    await access(p)
    const s = await stat(p)
    return s.isDirectory()
  } catch {
    return false
  }
}

export async function listRoots(): Promise<LibraryRoot[]> {
  const rows = selectRootRows()
  return Promise.all(
    rows.map(async (r) => rowToRoot(r, await isOnline(r.path), countFilesByRoot(r.id)))
  )
}

export async function addRootPath(path: string): Promise<LibraryRoot | null> {
  if (!(await isOnline(path))) return null
  const kind = classifyPath(path)
  const label = basename(path) || path
  let id: number
  try {
    id = insertRoot(path, label, kind)
  } catch {
    // UNIQUE: ya existía; devuelve la existente.
    const existing = selectRootRows().find((r) => r.path === path)
    if (!existing) return null
    return rowToRoot(existing, true, countFilesByRoot(existing.id))
  }
  const row = selectRootRow(id)!
  return rowToRoot(row, true, 0)
}

export function removeRoot(id: number): void {
  deleteRoot(id)
}

export function renameRoot(id: number, label: string): void {
  updateRootLabel(id, label.trim() || 'Sin nombre')
}
