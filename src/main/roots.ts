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
import { getScanState } from './state'
import { scanRoot } from './scanner'
import { syncWatchers } from './watcher'

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
    rows.map(async (r) =>
      rowToRoot(r, await isOnline(r.path), countFilesByRoot(r.id), getScanState(r.id))
    )
  )
}

export async function addRootPath(path: string): Promise<LibraryRoot | null> {
  if (!(await isOnline(path))) return null
  const kind = classifyPath(path)
  const label = basename(path) || path

  const existing = selectRootRows().find((r) => r.path === path)
  if (existing) {
    return rowToRoot(existing, true, countFilesByRoot(existing.id), getScanState(existing.id))
  }

  const id = insertRoot(path, label, kind)
  const row = selectRootRow(id)!
  // Escaneo inicial + watcher en segundo plano.
  void scanRoot(id).then(() => syncWatchers())
  return rowToRoot(row, true, 0, getScanState(id))
}

export async function removeRoot(id: number): Promise<void> {
  deleteRoot(id)
  await syncWatchers()
}

export function renameRoot(id: number, label: string): void {
  updateRootLabel(id, label.trim() || 'Sin nombre')
}
