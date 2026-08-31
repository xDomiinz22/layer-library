import { getDb } from './db'
import type { DuplicateGroup, DuplicateGroupMember } from '../shared/types'

/** Grupos de archivos con contenido idéntico (mismo hash), ordenados por espacio desperdiciado. */
export function listDuplicateGroups(limit = 400): DuplicateGroup[] {
  const d = getDb()
  const groups = d
    .prepare(
      `SELECT hash, MIN(size) AS size, COUNT(*) AS cnt
       FROM files WHERE hash IS NOT NULL
       GROUP BY hash HAVING COUNT(*) > 1
       ORDER BY (MIN(size) * (COUNT(*) - 1)) DESC
       LIMIT ?`
    )
    .all(limit) as unknown as { hash: string; size: number; cnt: number }[]

  if (groups.length === 0) return []

  const hashes = groups.map((g) => g.hash)
  const rows = d
    .prepare(
      `SELECT f.id, f.hash, f.path, f.rel_path AS relPath, f.root_id AS rootId,
              f.mtime_ms AS mtimeMs, f.thumb_file AS thumbFile, r.label AS rootLabel
       FROM files f JOIN roots r ON r.id = f.root_id
       WHERE f.hash IN (${hashes.map(() => '?').join(',')})
       ORDER BY f.mtime_ms ASC`
    )
    .all(...hashes) as unknown as (DuplicateGroupMember & { hash: string; thumbFile: string | null })[]

  const byHash = new Map<string, { members: DuplicateGroupMember[]; thumb: string | null }>()
  for (const r of rows) {
    let g = byHash.get(r.hash)
    if (!g) {
      g = { members: [], thumb: null }
      byHash.set(r.hash, g)
    }
    if (!g.thumb && r.thumbFile) g.thumb = r.thumbFile
    g.members.push({
      id: r.id,
      path: r.path,
      relPath: r.relPath,
      rootId: r.rootId,
      rootLabel: r.rootLabel,
      mtimeMs: r.mtimeMs
    })
  }

  return groups.map((g) => {
    const info = byHash.get(g.hash)!
    return {
      hash: g.hash,
      size: g.size,
      wasted: g.size * (g.cnt - 1),
      thumbFile: info.thumb,
      members: info.members
    }
  })
}
