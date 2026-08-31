import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import type {
  DuplicateSibling,
  FileDetail,
  FileSort,
  LibraryRoot,
  LibraryStats,
  ListFilesOptions,
  ListFilesResult,
  MeshMeta,
  ModelFile,
  ModelFormat,
  RootKind,
  ScanPhase
} from '../shared/types'

let db: DatabaseSync

const SCHEMA = `
CREATE TABLE IF NOT EXISTS roots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  path         TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'local',
  added_at     INTEGER NOT NULL,
  last_scan_at INTEGER
);

CREATE TABLE IF NOT EXISTS files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  root_id      INTEGER NOT NULL REFERENCES roots(id) ON DELETE CASCADE,
  path         TEXT NOT NULL UNIQUE,
  rel_path     TEXT NOT NULL,
  name         TEXT NOT NULL,
  format       TEXT NOT NULL,
  size         INTEGER NOT NULL,
  mtime_ms     INTEGER NOT NULL,
  hash         TEXT,
  thumb_status TEXT NOT NULL DEFAULT 'pending',
  thumb_file   TEXT,
  scan_gen     INTEGER,
  added_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_root ON files(root_id);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
CREATE INDEX IF NOT EXISTS idx_files_format ON files(format);
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime_ms);

CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
  name, rel_path,
  content='files', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
  INSERT INTO files_fts(rowid, name, rel_path) VALUES (new.id, new.name, new.rel_path);
END;
CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name, rel_path) VALUES ('delete', old.id, old.name, old.rel_path);
END;
CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name, rel_path) VALUES ('delete', old.id, old.name, old.rel_path);
  INSERT INTO files_fts(rowid, name, rel_path) VALUES (new.id, new.name, new.rel_path);
END;

CREATE TABLE IF NOT EXISTS collections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'collection',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collection_files (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  file_id       INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, file_id)
);

CREATE TABLE IF NOT EXISTS printers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  sort       REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS queue_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id    INTEGER NOT NULL UNIQUE REFERENCES files(id) ON DELETE CASCADE,
  printer_id INTEGER REFERENCES printers(id) ON DELETE SET NULL,
  sort       REAL NOT NULL,
  printed    INTEGER NOT NULL DEFAULT 0,
  added_at   INTEGER NOT NULL
);
`

/** Migraciones aditivas idempotentes (ALTER TABLE ADD COLUMN lanza si ya existe). */
function migrate(d: DatabaseSync): void {
  const add = (sql: string): void => {
    try {
      d.exec(sql)
    } catch {
      /* columna ya existente */
    }
  }
  add('ALTER TABLE files ADD COLUMN scan_gen INTEGER')
  add('ALTER TABLE files ADD COLUMN tri_count INTEGER')
  add('ALTER TABLE files ADD COLUMN dim_x REAL')
  add('ALTER TABLE files ADD COLUMN dim_y REAL')
  add('ALTER TABLE files ADD COLUMN dim_z REAL')
  // Metadatos de impresión (3MF / GCODE)
  add("ALTER TABLE files ADD COLUMN print_status TEXT DEFAULT 'pending'")
  add('ALTER TABLE files ADD COLUMN print_seconds INTEGER')
  add('ALTER TABLE files ADD COLUMN filament_g REAL')
  add('ALTER TABLE files ADD COLUMN filament_types TEXT')
  add('ALTER TABLE files ADD COLUMN filament_colors TEXT')
  add('ALTER TABLE files ADD COLUMN plate_count INTEGER')
}

export function initDb(): DatabaseSync {
  const file = join(app.getPath('userData'), 'library.db')
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  migrate(db)
  return db
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('DB no inicializada')
  return db
}

// --- Roots ---------------------------------------------------------------

interface RootRow {
  id: number
  path: string
  label: string
  kind: string
  added_at: number
  last_scan_at: number | null
}

function rowToRoot(
  r: RootRow,
  online: boolean,
  fileCount: number,
  scanState: ScanPhase
): LibraryRoot {
  return {
    id: r.id,
    path: r.path,
    label: r.label,
    kind: r.kind as RootKind,
    online,
    addedAt: r.added_at,
    lastScanAt: r.last_scan_at,
    fileCount,
    scanState
  }
}

export function insertRoot(path: string, label: string, kind: RootKind): number {
  const info = getDb()
    .prepare('INSERT INTO roots (path, label, kind, added_at) VALUES (?, ?, ?, ?)')
    .run(path, label, kind, Date.now())
  return Number(info.lastInsertRowid)
}

export function deleteRoot(id: number): void {
  getDb().prepare('DELETE FROM roots WHERE id = ?').run(id)
}

export function updateRootLabel(id: number, label: string): void {
  getDb().prepare('UPDATE roots SET label = ? WHERE id = ?').run(label, id)
}

export function touchRootScan(id: number): void {
  getDb().prepare('UPDATE roots SET last_scan_at = ? WHERE id = ?').run(Date.now(), id)
}

export function selectRootRows(): RootRow[] {
  return getDb().prepare('SELECT * FROM roots ORDER BY added_at ASC').all() as unknown as RootRow[]
}

export function selectRootRow(id: number): RootRow | undefined {
  return getDb().prepare('SELECT * FROM roots WHERE id = ?').get(id) as unknown as
    | RootRow
    | undefined
}

export function countFilesByRoot(rootId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM files WHERE root_id = ?')
    .get(rootId) as unknown as { n: number }
  return row.n
}

// --- Files: escritura ----------------------------------------------------

export interface WalkedFile {
  path: string
  relPath: string
  name: string
  format: ModelFormat
  size: number
  mtimeMs: number
}

/**
 * Inserta o actualiza un archivo. Si es nuevo o cambió (tamaño/mtime), resetea
 * hash y estado de miniatura. Siempre marca la generación de escaneo actual.
 * Devuelve true si el archivo es nuevo o ha cambiado.
 */
export function upsertFile(rootId: number, f: WalkedFile, gen: number): boolean {
  const existing = getDb()
    .prepare('SELECT id, size, mtime_ms FROM files WHERE path = ?')
    .get(f.path) as unknown as { id: number; size: number; mtime_ms: number } | undefined

  if (!existing) {
    getDb()
      .prepare(
        `INSERT INTO files (root_id, path, rel_path, name, format, size, mtime_ms, hash, thumb_status, scan_gen, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?)`
      )
      .run(rootId, f.path, f.relPath, f.name, f.format, f.size, Math.round(f.mtimeMs), gen, Date.now())
    return true
  }

  const changed = existing.size !== f.size || Math.round(existing.mtime_ms) !== Math.round(f.mtimeMs)
  if (changed) {
    getDb()
      .prepare(
        `UPDATE files SET rel_path = ?, name = ?, format = ?, size = ?, mtime_ms = ?,
           hash = NULL, thumb_status = 'pending', thumb_file = NULL,
           print_status = 'pending', print_seconds = NULL, filament_g = NULL,
           filament_types = NULL, filament_colors = NULL, plate_count = NULL,
           scan_gen = ?
         WHERE id = ?`
      )
      .run(f.relPath, f.name, f.format, f.size, Math.round(f.mtimeMs), gen, existing.id)
  } else {
    getDb().prepare('UPDATE files SET scan_gen = ? WHERE id = ?').run(gen, existing.id)
  }
  return changed
}

/** Borra los archivos de una raíz que no se vieron en la generación `gen`. */
export function pruneRoot(rootId: number, gen: number): number {
  const info = getDb()
    .prepare('DELETE FROM files WHERE root_id = ? AND (scan_gen IS NULL OR scan_gen != ?)')
    .run(rootId, gen)
  return Number(info.changes)
}

export function deleteFileByPath(path: string): void {
  getDb().prepare('DELETE FROM files WHERE path = ?').run(path)
}

export function setFileHash(id: number, hash: string): void {
  getDb().prepare('UPDATE files SET hash = ? WHERE id = ?').run(hash, id)
}

export function selectPendingHashFiles(limit = 100000): { id: number; path: string }[] {
  return getDb()
    .prepare(
      `SELECT f.id, f.path FROM files f
       WHERE f.hash IS NULL
       ORDER BY f.size ASC
       LIMIT ?`
    )
    .all(limit) as unknown as { id: number; path: string }[]
}

export function countPendingHash(): number {
  return (
    getDb().prepare('SELECT COUNT(*) AS n FROM files WHERE hash IS NULL').get() as unknown as {
      n: number
    }
  ).n
}

// --- Miniaturas --------------------------------------------------------

export interface PendingThumb {
  id: number
  path: string
  format: ModelFormat
  hash: string
}

export function selectPendingThumbFiles(limit = 100000): PendingThumb[] {
  return getDb()
    .prepare(
      `SELECT id, path, format, hash FROM files
       WHERE thumb_status = 'pending' AND hash IS NOT NULL
       ORDER BY mtime_ms DESC
       LIMIT ?`
    )
    .all(limit) as unknown as PendingThumb[]
}

export function countPendingThumb(): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM files WHERE thumb_status = 'pending' AND hash IS NOT NULL")
      .get() as unknown as { n: number }
  ).n
}

/** Miniatura ya lista para un hash concreto (para reutilizar entre duplicados). */
export function findThumbByHash(hash: string): string | null {
  const row = getDb()
    .prepare(
      "SELECT thumb_file FROM files WHERE hash = ? AND thumb_status = 'ready' AND thumb_file IS NOT NULL LIMIT 1"
    )
    .get(hash) as unknown as { thumb_file: string } | undefined
  return row?.thumb_file ?? null
}

/** Marca el resultado para TODOS los archivos pendientes con ese hash. */
export function setThumbResultByHash(
  hash: string,
  status: 'ready' | 'failed',
  file: string | null,
  meta?: MeshMeta | null
): void {
  if (meta) {
    getDb()
      .prepare(
        `UPDATE files SET thumb_status = ?, thumb_file = ?, tri_count = ?, dim_x = ?, dim_y = ?, dim_z = ?
         WHERE hash = ? AND thumb_status IN ('pending','failed')`
      )
      .run(status, file, meta.triCount, meta.dim[0], meta.dim[1], meta.dim[2], hash)
  } else {
    getDb()
      .prepare(
        "UPDATE files SET thumb_status = ?, thumb_file = ? WHERE hash = ? AND thumb_status IN ('pending','failed')"
      )
      .run(status, file, hash)
  }
}

export function setThumbResult(id: number, status: 'ready' | 'failed', file: string | null): void {
  getDb().prepare('UPDATE files SET thumb_status = ?, thumb_file = ? WHERE id = ?').run(status, file, id)
}

// --- Metadatos de impresión (3MF / GCODE) --------------------------

export interface PendingMeta {
  id: number
  path: string
  format: ModelFormat
  hash: string
  size: number
}

export function selectPendingMetaFiles(limit = 100000): PendingMeta[] {
  return getDb()
    .prepare(
      `SELECT id, path, format, hash, size FROM files
       WHERE print_status = 'pending' AND hash IS NOT NULL
         AND format IN ('3mf','gcode')
       ORDER BY mtime_ms DESC
       LIMIT ?`
    )
    .all(limit) as unknown as PendingMeta[]
}

export function countPendingMeta(): number {
  return (
    getDb()
      .prepare(
        "SELECT COUNT(*) AS n FROM files WHERE print_status = 'pending' AND hash IS NOT NULL AND format IN ('3mf','gcode')"
      )
      .get() as unknown as { n: number }
  ).n
}

export interface PrintInfo {
  seconds: number | null
  grams: number | null
  types: string[]
  colors: string[]
  plates: number | null
}

/** Guarda los metadatos de impresión para todos los archivos con ese hash. */
export function setPrintInfoByHash(hash: string, info: PrintInfo | null): void {
  getDb()
    .prepare(
      `UPDATE files SET print_status = 'done', print_seconds = ?, filament_g = ?,
         filament_types = ?, filament_colors = ?, plate_count = ?
       WHERE hash = ? AND print_status = 'pending'`
    )
    .run(
      info?.seconds ?? null,
      info?.grams ?? null,
      info && info.types.length ? info.types.join(',') : null,
      info && info.colors.length ? info.colors.join(',') : null,
      info?.plates ?? null,
      hash
    )
}

// --- Files: lectura / stats -------------------------------------------

interface FileRow {
  id: number
  root_id: number
  path: string
  rel_path: string
  name: string
  format: string
  size: number
  mtime_ms: number
  hash: string | null
  thumb_status: string
  thumb_file: string | null
  added_at: number
  tri_count: number | null
  dim_x: number | null
  dim_y: number | null
  dim_z: number | null
  print_seconds: number | null
  filament_g: number | null
  filament_types: string | null
  filament_colors: string | null
  plate_count: number | null
}

function splitList(s: string | null): string[] {
  return s ? s.split(',').filter(Boolean) : []
}

export function rowToFile(r: FileRow): ModelFile {
  return {
    id: r.id,
    rootId: r.root_id,
    path: r.path,
    relPath: r.rel_path,
    name: r.name,
    format: r.format as ModelFormat,
    size: r.size,
    mtimeMs: r.mtime_ms,
    hash: r.hash,
    thumbStatus: r.thumb_status as ModelFile['thumbStatus'],
    thumbFile: r.thumb_file,
    addedAt: r.added_at,
    triCount: r.tri_count,
    dim:
      r.dim_x != null && r.dim_y != null && r.dim_z != null
        ? [r.dim_x, r.dim_y, r.dim_z]
        : null,
    printSeconds: r.print_seconds,
    filamentG: r.filament_g,
    filamentTypes: splitList(r.filament_types),
    filamentColors: splitList(r.filament_colors),
    plateCount: r.plate_count
  }
}

/** Convierte texto libre en una consulta FTS5 con prefijo por token. */
function ftsQuery(raw: string): string | null {
  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/["*]/g, '').trim())
    .filter(Boolean)
  if (tokens.length === 0) return null
  return tokens.map((t) => `"${t}"*`).join(' ')
}

const SORT_SQL: Record<FileSort, string> = {
  recent: 'f.mtime_ms DESC',
  oldest: 'f.mtime_ms ASC',
  name: 'f.name COLLATE NOCASE ASC',
  size: 'f.size DESC',
  'size-asc': 'f.size ASC',
  time: 'f.print_seconds DESC NULLS LAST',
  'time-asc': 'f.print_seconds ASC NULLS LAST',
  grams: 'f.filament_g DESC NULLS LAST'
}

const DATE_WINDOW_MS: Record<string, number> = {
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
  '365d': 31_536_000_000
}

export function listFiles(opts: ListFilesOptions): ListFilesResult {
  const where: string[] = []
  const params: (string | number)[] = []
  let from = 'FROM files f'

  const fts = opts.query ? ftsQuery(opts.query) : null
  if (fts) {
    from += ' JOIN files_fts ON files_fts.rowid = f.id'
    where.push('files_fts MATCH ?')
    params.push(fts)
  }
  if (opts.formats && opts.formats.length > 0) {
    where.push(`f.format IN (${opts.formats.map(() => '?').join(',')})`)
    params.push(...opts.formats)
  }
  if (opts.rootId != null) {
    where.push('f.root_id = ?')
    params.push(opts.rootId)
  }
  if (opts.dateWindow && opts.dateWindow !== 'any' && DATE_WINDOW_MS[opts.dateWindow]) {
    where.push('f.mtime_ms >= ?')
    params.push(Date.now() - DATE_WINDOW_MS[opts.dateWindow])
  }
  if (opts.onlyDuplicates) {
    where.push(
      'f.hash IN (SELECT hash FROM files WHERE hash IS NOT NULL GROUP BY hash HAVING COUNT(*) > 1)'
    )
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = (
    getDb()
      .prepare(`SELECT COUNT(*) AS n ${from} ${whereSql}`)
      .get(...params) as unknown as { n: number }
  ).n

  const sort = SORT_SQL[opts.sort ?? 'recent'] ?? SORT_SQL.recent
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 200000)
  const offset = Math.max(opts.offset ?? 0, 0)

  const rows = getDb()
    .prepare(`SELECT f.* ${from} ${whereSql} ORDER BY ${sort}, f.id LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as unknown as FileRow[]

  return { items: rows.map(rowToFile), total }
}

export function getFileDetail(id: number): FileDetail | null {
  const d = getDb()
  const row = d.prepare('SELECT * FROM files WHERE id = ?').get(id) as unknown as
    | FileRow
    | undefined
  if (!row) return null
  const root = d
    .prepare('SELECT label, path FROM roots WHERE id = ?')
    .get(row.root_id) as unknown as { label: string; path: string } | undefined

  let duplicates: DuplicateSibling[] = []
  if (row.hash) {
    duplicates = (
      d
        .prepare(
          `SELECT f.id, f.path, f.rel_path AS relPath, r.label AS rootLabel
           FROM files f JOIN roots r ON r.id = f.root_id
           WHERE f.hash = ? AND f.id != ?
           ORDER BY f.path`
        )
        .all(row.hash, id) as unknown as DuplicateSibling[]
    ).map((x) => ({ ...x }))
  }

  const collectionIds = (
    d
      .prepare('SELECT collection_id AS c FROM collection_files WHERE file_id = ?')
      .all(id) as unknown as { c: number }[]
  ).map((x) => x.c)
  const inQueue =
    (d.prepare('SELECT 1 FROM queue_items WHERE file_id = ?').get(id) as unknown) != null

  return {
    file: rowToFile(row),
    rootLabel: root?.label ?? '—',
    rootPath: root?.path ?? '',
    duplicates,
    collectionIds,
    inQueue
  }
}

// --- Acceso a archivos por id (para colecciones / cola) --------------

export function getFileRowById(id: number): FileRow | undefined {
  return getDb().prepare('SELECT * FROM files WHERE id = ?').get(id) as unknown as
    | FileRow
    | undefined
}

export function getFilesByIds(ids: number[]): ModelFile[] {
  if (ids.length === 0) return []
  const rows = getDb()
    .prepare(`SELECT * FROM files WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as unknown as FileRow[]
  const byId = new Map(rows.map((r) => [r.id, rowToFile(r)]))
  return ids.map((i) => byId.get(i)).filter((x): x is ModelFile => x != null)
}

export function computeStats(rootId?: number | null): LibraryStats {
  const d = getDb()
  const w = rootId != null ? ' WHERE root_id = ?' : ''
  const p: number[] = rootId != null ? [rootId] : []

  const totals = d
    .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS s FROM files${w}`)
    .get(...p) as unknown as { n: number; s: number }

  const byFormat = (
    d
      .prepare(
        `SELECT format, COUNT(*) AS count, COALESCE(SUM(size),0) AS size FROM files${w} GROUP BY format ORDER BY count DESC`
      )
      .all(...p) as unknown as { format: string; count: number; size: number }[]
  ).map((r) => ({ format: r.format as ModelFormat, count: r.count, size: r.size }))

  const pendingHash = (
    d
      .prepare(`SELECT COUNT(*) AS n FROM files${w ? w + ' AND' : ' WHERE'} hash IS NULL`)
      .get(...p) as unknown as { n: number }
  ).n
  const pendingThumb = (
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM files${w ? w + ' AND' : ' WHERE'} thumb_status = 'pending'`
      )
      .get(...p) as unknown as { n: number }
  ).n
  const pendingMeta = (
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM files${w ? w + ' AND' : ' WHERE'} print_status = 'pending' AND format IN ('3mf','gcode')`
      )
      .get(...p) as unknown as { n: number }
  ).n

  // Los duplicados se calculan siempre globalmente: el valor está en detectar
  // la misma pieza repetida ENTRE bibliotecas.
  const dup = d
    .prepare(
      `SELECT COUNT(*) AS groups, COALESCE(SUM(cnt-1),0) AS dupFiles, COALESCE(SUM((cnt-1)*sz),0) AS wasted
       FROM (SELECT hash, COUNT(*) AS cnt, MIN(size) AS sz FROM files
             WHERE hash IS NOT NULL GROUP BY hash HAVING COUNT(*) > 1)`
    )
    .get() as unknown as { groups: number; dupFiles: number; wasted: number }

  return {
    totalFiles: totals.n,
    totalSize: totals.s,
    byFormat,
    pendingHash,
    pendingThumb,
    pendingMeta,
    duplicateGroups: dup.groups,
    duplicateFiles: dup.dupFiles,
    wastedBytes: dup.wasted
  }
}

export { rowToRoot }
