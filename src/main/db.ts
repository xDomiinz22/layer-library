import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import type { LibraryRoot, RootKind } from '../shared/types'

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
  added_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_root ON files(root_id);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
CREATE INDEX IF NOT EXISTS idx_files_format ON files(format);

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
`

export function initDb(): DatabaseSync {
  const file = join(app.getPath('userData'), 'library.db')
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('DB no inicializada')
  return db
}

// --- Roots -----------------------------------------------------------------

interface RootRow {
  id: number
  path: string
  label: string
  kind: string
  added_at: number
  last_scan_at: number | null
}

function rowToRoot(r: RootRow, online: boolean, fileCount: number): LibraryRoot {
  return {
    id: r.id,
    path: r.path,
    label: r.label,
    kind: r.kind as RootKind,
    online,
    addedAt: r.added_at,
    lastScanAt: r.last_scan_at,
    fileCount
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

export function selectRootRows(): RootRow[] {
  return getDb().prepare('SELECT * FROM roots ORDER BY added_at ASC').all() as unknown as RootRow[]
}

export function selectRootRow(id: number): RootRow | undefined {
  return getDb().prepare('SELECT * FROM roots WHERE id = ?').get(id) as unknown as RootRow | undefined
}

export function countFilesByRoot(rootId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM files WHERE root_id = ?')
    .get(rootId) as unknown as { n: number }
  return row.n
}

export { rowToRoot }
