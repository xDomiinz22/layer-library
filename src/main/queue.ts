import { getDb, getFileRowById, rowToFile } from './db'
import type { Printer, QueueItem } from '../shared/types'

export function listPrinters(): Printer[] {
  return getDb()
    .prepare('SELECT id, name FROM printers ORDER BY sort, name COLLATE NOCASE')
    .all() as unknown as Printer[]
}

export function createPrinter(name: string): Printer {
  const clean = name.trim() || 'Impresora'
  const max = (
    getDb().prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM printers').get() as unknown as {
      m: number
    }
  ).m
  const info = getDb()
    .prepare('INSERT INTO printers (name, sort, created_at) VALUES (?, ?, ?)')
    .run(clean, max + 1, Date.now())
  return { id: Number(info.lastInsertRowid), name: clean }
}

export function renamePrinter(id: number, name: string): void {
  getDb()
    .prepare('UPDATE printers SET name = ? WHERE id = ?')
    .run(name.trim() || 'Impresora', id)
}

export function deletePrinter(id: number): void {
  getDb().prepare('DELETE FROM printers WHERE id = ?').run(id)
}

interface QueueRow {
  id: number
  file_id: number
  printer_id: number | null
  sort: number
  printed: number
  added_at: number
}

export function listQueue(): QueueItem[] {
  const rows = getDb()
    .prepare('SELECT * FROM queue_items ORDER BY printed, sort, added_at')
    .all() as unknown as QueueRow[]
  const out: QueueItem[] = []
  for (const r of rows) {
    const fr = getFileRowById(r.file_id)
    if (!fr) continue
    out.push({
      id: r.id,
      file: rowToFile(fr),
      printerId: r.printer_id,
      sort: r.sort,
      printed: !!r.printed,
      addedAt: r.added_at
    })
  }
  return out
}

export function addToQueue(fileId: number, printerId: number | null): void {
  const max = (
    getDb().prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM queue_items').get() as unknown as {
      m: number
    }
  ).m
  getDb()
    .prepare(
      `INSERT INTO queue_items (file_id, printer_id, sort, added_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(file_id) DO UPDATE SET printer_id = excluded.printer_id`
    )
    .run(fileId, printerId, max + 1, Date.now())
}

export function removeFromQueue(itemId: number): void {
  getDb().prepare('DELETE FROM queue_items WHERE id = ?').run(itemId)
}

export function toggleQueue(fileId: number): boolean {
  const d = getDb()
  const existing = d.prepare('SELECT id FROM queue_items WHERE file_id = ?').get(fileId) as unknown as
    | { id: number }
    | undefined
  if (existing) {
    d.prepare('DELETE FROM queue_items WHERE id = ?').run(existing.id)
    return false
  }
  addToQueue(fileId, null)
  return true
}

export function updateQueueItem(
  itemId: number,
  patch: { printerId?: number | null; printed?: boolean }
): void {
  if (patch.printerId !== undefined) {
    getDb()
      .prepare('UPDATE queue_items SET printer_id = ? WHERE id = ?')
      .run(patch.printerId, itemId)
  }
  if (patch.printed !== undefined) {
    getDb()
      .prepare('UPDATE queue_items SET printed = ? WHERE id = ?')
      .run(patch.printed ? 1 : 0, itemId)
  }
}

/** Intercambia el orden con el vecino dentro del mismo grupo (misma impresora, no impreso). */
export function moveQueueItem(itemId: number, direction: 'up' | 'down'): void {
  const d = getDb()
  const item = d.prepare('SELECT * FROM queue_items WHERE id = ?').get(itemId) as unknown as
    | QueueRow
    | undefined
  if (!item) return
  const cmp = direction === 'up' ? '<' : '>'
  const order = direction === 'up' ? 'DESC' : 'ASC'
  const neighbor = d
    .prepare(
      `SELECT * FROM queue_items
       WHERE printed = ? AND IFNULL(printer_id, -1) = IFNULL(?, -1) AND sort ${cmp} ?
       ORDER BY sort ${order} LIMIT 1`
    )
    .get(item.printed, item.printer_id, item.sort) as unknown as QueueRow | undefined
  if (!neighbor) return
  d.prepare('UPDATE queue_items SET sort = ? WHERE id = ?').run(neighbor.sort, item.id)
  d.prepare('UPDATE queue_items SET sort = ? WHERE id = ?').run(item.sort, neighbor.id)
}
