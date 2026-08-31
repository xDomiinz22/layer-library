import { relative, sep } from 'node:path'
import { access, stat } from 'node:fs/promises'
import chokidar, { type FSWatcher } from 'chokidar'
import { deleteFileByPath, selectRootRows, upsertFile, type WalkedFile } from './db'
import { emitLibraryChanged } from './emit'
import { formatOf } from './walk'
import { hashPending } from './hasher'

const SKIP_SEGMENTS = new Set([
  'node_modules',
  '.git',
  '$RECYCLE.BIN',
  'System Volume Information',
  '#recycle',
  '@eaDir'
])

interface Watched {
  id: number
  path: string
  watcher: FSWatcher
}

const watchers = new Map<number, Watched>()
let hashDebounce: NodeJS.Timeout | null = null

function scheduleHash(): void {
  if (hashDebounce) clearTimeout(hashDebounce)
  hashDebounce = setTimeout(() => {
    hashDebounce = null
    void hashPending()
  }, 2000)
}

function ignored(path: string, stats?: { isFile(): boolean }): boolean {
  const segs = path.split(sep)
  for (const s of segs) {
    if (SKIP_SEGMENTS.has(s)) return true
    if (s.length > 1 && s.startsWith('.')) return true
  }
  if (stats?.isFile() && !formatOf(path)) return true
  return false
}

async function onUpsert(rootId: number, rootPath: string, filePath: string): Promise<void> {
  if (!formatOf(filePath)) return
  try {
    const s = await stat(filePath)
    if (!s.isFile()) return
    const format = formatOf(filePath)!
    const wf: WalkedFile = {
      path: filePath,
      relPath: relative(rootPath, filePath).split('\\').join('/'),
      name: filePath.split(sep).pop() ?? filePath,
      format,
      size: s.size,
      mtimeMs: s.mtimeMs
    }
    upsertFile(rootId, wf, Date.now())
    emitLibraryChanged()
    scheduleHash()
  } catch {
    /* desapareció */
  }
}

function onRemove(filePath: string): void {
  if (!formatOf(filePath)) return
  deleteFileByPath(filePath)
  emitLibraryChanged()
}

async function reachable(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Alinea los watchers activos con las raíces accesibles de la BD. */
export async function syncWatchers(): Promise<void> {
  const roots = selectRootRows()
  const wanted = new Map<number, string>()
  for (const r of roots) {
    if (await reachable(r.path)) wanted.set(r.id, r.path)
  }

  for (const [id, w] of watchers) {
    if (!wanted.has(id) || wanted.get(id) !== w.path) {
      void w.watcher.close()
      watchers.delete(id)
    }
  }

  for (const [id, path] of wanted) {
    if (watchers.has(id)) continue
    const watcher = chokidar.watch(path, {
      ignored,
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 }
    })
    watcher.on('add', (p) => void onUpsert(id, path, p))
    watcher.on('change', (p) => void onUpsert(id, path, p))
    watcher.on('unlink', (p) => onRemove(p))
    watchers.set(id, { id, path, watcher })
  }
}

export async function closeWatchers(): Promise<void> {
  await Promise.all([...watchers.values()].map((w) => w.watcher.close()))
  watchers.clear()
}
