import { relative } from 'node:path'
import { access } from 'node:fs/promises'
import {
  getDb,
  pruneRoot,
  selectRootRow,
  selectRootRows,
  touchRootScan,
  upsertFile,
  type WalkedFile
} from './db'
import { walk } from './walk'
import { emitLibraryChanged, emitScanProgress } from './emit'
import { setScanState } from './state'
import { hashPending } from './hasher'

const inFlight = new Set<number>()

async function isReachable(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Escanea una raíz: recorre, hace upsert incremental y poda lo que ya no existe. */
export async function scanRoot(rootId: number): Promise<void> {
  if (inFlight.has(rootId)) return
  const root = selectRootRow(rootId)
  if (!root) return
  if (!(await isReachable(root.path))) {
    setScanState(rootId, 'idle')
    return
  }

  inFlight.add(rootId)
  setScanState(rootId, 'walking')
  const db = getDb()
  const gen = Date.now()
  let discovered = 0
  let changed = 0
  let open = false

  try {
    db.exec('BEGIN')
    open = true
    for await (const hit of walk(root.path)) {
      const wf: WalkedFile = {
        path: hit.path,
        relPath: relative(root.path, hit.path).split('\\').join('/'),
        name: hit.name,
        format: hit.format,
        size: hit.size,
        mtimeMs: hit.mtimeMs
      }
      if (upsertFile(rootId, wf, gen)) changed++
      discovered++
      if (discovered % 500 === 0) {
        db.exec('COMMIT')
        open = false
        emitScanProgress({
          rootId,
          phase: 'walking',
          discovered,
          processed: 0,
          total: 0,
          message: root.label
        })
        db.exec('BEGIN')
        open = true
      }
    }
    db.exec('COMMIT')
    open = false

    const pruned = pruneRoot(rootId, gen)
    touchRootScan(rootId)
    if (changed > 0 || pruned > 0) emitLibraryChanged()

    emitScanProgress({
      rootId,
      phase: 'walking',
      discovered,
      processed: discovered,
      total: discovered,
      message: `${root.label}: ${discovered.toLocaleString('es')} archivos`
    })
  } catch {
    if (open) {
      try {
        db.exec('ROLLBACK')
      } catch {
        /* nada que revertir */
      }
    }
    setScanState(rootId, 'error')
    emitScanProgress({
      rootId,
      phase: 'error',
      discovered,
      processed: 0,
      total: 0,
      message: `Error al escanear ${root.label}`
    })
    inFlight.delete(rootId)
    return
  }

  inFlight.delete(rootId)
  setScanState(rootId, 'idle')
  // Encadena la fase de hashing (global, de-duplicada internamente).
  void hashPending()
}

export async function scanAll(): Promise<void> {
  for (const r of selectRootRows()) {
    await scanRoot(r.id)
  }
}
