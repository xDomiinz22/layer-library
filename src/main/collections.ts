import { getDb, getFilesByIds } from './db'
import type { Collection, CollectionKind, ModelFile } from '../shared/types'

export function listCollections(): Collection[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.name, c.kind,
              (SELECT COUNT(*) FROM collection_files cf WHERE cf.collection_id = c.id) AS fileCount
       FROM collections c
       ORDER BY c.kind, c.name COLLATE NOCASE`
    )
    .all() as unknown as Collection[]
}

export function createCollection(name: string, kind: CollectionKind): Collection {
  const clean = name.trim() || 'Sin nombre'
  const info = getDb()
    .prepare('INSERT INTO collections (name, kind, created_at) VALUES (?, ?, ?)')
    .run(clean, kind === 'creator' ? 'creator' : 'collection', Date.now())
  return { id: Number(info.lastInsertRowid), name: clean, kind, fileCount: 0 }
}

export function renameCollection(id: number, name: string): void {
  getDb()
    .prepare('UPDATE collections SET name = ? WHERE id = ?')
    .run(name.trim() || 'Sin nombre', id)
}

export function deleteCollection(id: number): void {
  getDb().prepare('DELETE FROM collections WHERE id = ?').run(id)
}

export function setFileCollection(fileId: number, collectionId: number, member: boolean): void {
  if (member) {
    getDb()
      .prepare(
        'INSERT OR IGNORE INTO collection_files (collection_id, file_id) VALUES (?, ?)'
      )
      .run(collectionId, fileId)
  } else {
    getDb()
      .prepare('DELETE FROM collection_files WHERE collection_id = ? AND file_id = ?')
      .run(collectionId, fileId)
  }
}

export function listCollectionFiles(collectionId: number): ModelFile[] {
  const ids = (
    getDb()
      .prepare(
        `SELECT cf.file_id AS id FROM collection_files cf
         JOIN files f ON f.id = cf.file_id
         WHERE cf.collection_id = ?
         ORDER BY f.name COLLATE NOCASE`
      )
      .all(collectionId) as unknown as { id: number }[]
  ).map((x) => x.id)
  return getFilesByIds(ids)
}
