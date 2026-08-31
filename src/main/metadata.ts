import { open, readFile, stat } from 'node:fs/promises'
import {
  countPendingMeta,
  selectPendingMetaFiles,
  setPrintInfoByHash,
  type PendingMeta,
  type PrintInfo
} from './db'
import { emitLibraryChanged, emitScanProgress } from './emit'
import { extract3mfPrintInfo } from './threemf'
import { extractGcodeInfo } from './gcode'

const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024

async function readHead(path: string, n: number, size: number): Promise<Buffer> {
  const fh = await open(path, 'r')
  try {
    const len = Math.min(n, size)
    const head = Buffer.alloc(len)
    await fh.read(head, 0, len, 0)
    if (size <= n) return head
    const tail = Buffer.alloc(n)
    await fh.read(tail, 0, n, size - n)
    return Buffer.concat([head, tail])
  } finally {
    await fh.close()
  }
}

/** Extrae los metadatos de impresión de un archivo 3MF o G-code. */
export async function extractPrintInfo(
  format: 'gcode' | '3mf',
  path: string,
  size: number
): Promise<PrintInfo | null> {
  if (format === 'gcode') {
    const buf = await readHead(path, 200_000, size)
    return extractGcodeInfo(buf.toString('latin1'))
  }
  if (size > MAX_ZIP_BYTES) return null
  return extract3mfPrintInfo(await readFile(path))
}

let running = false
let rerun = false

async function processOne(f: PendingMeta): Promise<void> {
  try {
    const info = await extractPrintInfo(f.format as 'gcode' | '3mf', f.path, f.size)
    setPrintInfoByHash(f.hash, info)
  } catch {
    setPrintInfoByHash(f.hash, null)
  }
}

/** Lee los metadatos de impresión de todos los 3MF/GCODE pendientes. */
export async function metadataPending(): Promise<void> {
  if (running) {
    rerun = true
    return
  }
  running = true
  try {
    do {
      rerun = false
      const pending = selectPendingMetaFiles()
      const total = pending.length
      if (total === 0) break

      let processed = 0
      for (const f of pending) {
        // stat por si el tamaño en BD está desactualizado
        try {
          const s = await stat(f.path)
          f.size = s.size
        } catch {
          /* usa el tamaño de la BD */
        }
        await processOne(f)
        processed++
        if (processed % 12 === 0 || processed === total) {
          emitScanProgress({
            rootId: null,
            phase: 'metadata',
            discovered: 0,
            processed,
            total,
            message: `Leyendo metadatos de impresión… ${processed.toLocaleString('es')}/${total.toLocaleString('es')}`
          })
          emitLibraryChanged()
        }
      }
    } while (rerun)
  } finally {
    running = false
  }
  emitScanProgress({ rootId: null, phase: 'done', discovered: 0, processed: 0, total: 0 })
  emitLibraryChanged()
}

export function pendingMetaCount(): number {
  return countPendingMeta()
}
