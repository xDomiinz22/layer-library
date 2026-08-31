import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { countPendingHash, selectPendingHashFiles, setFileHash } from './db'
import { emitLibraryChanged, emitScanProgress } from './emit'

const CONCURRENCY = 4

let running = false
let rerun = false

function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    const s = createReadStream(path)
    s.on('error', reject)
    s.on('data', (chunk) => h.update(chunk))
    s.on('end', () => resolve(h.digest('hex')))
  })
}

/**
 * Calcula el hash sha256 de todos los archivos con `hash IS NULL`.
 * De-duplicado: si ya está corriendo, se re-encola una pasada extra.
 */
export async function hashPending(): Promise<void> {
  if (running) {
    rerun = true
    return
  }
  running = true
  try {
    do {
      rerun = false
      const pending = selectPendingHashFiles()
      const total = pending.length
      if (total === 0) break

      let processed = 0
      let sinceEmit = 0

      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const batch = pending.slice(i, i + CONCURRENCY)
        await Promise.all(
          batch.map(async (f) => {
            try {
              const hash = await hashFile(f.path)
              setFileHash(f.id, hash)
            } catch {
              /* archivo ilegible / desaparecido: se reintentará en el próximo escaneo */
            }
          })
        )
        processed += batch.length
        sinceEmit += batch.length
        if (sinceEmit >= 40 || processed === total) {
          sinceEmit = 0
          emitScanProgress({
            rootId: null,
            phase: 'hashing',
            discovered: 0,
            processed,
            total,
            message: `Calculando huellas… ${processed.toLocaleString('es')}/${total.toLocaleString('es')}`
          })
          emitLibraryChanged()
        }
      }
    } while (rerun)
  } finally {
    running = false
  }

  emitScanProgress({
    rootId: null,
    phase: 'done',
    discovered: 0,
    processed: 0,
    total: 0
  })
  emitLibraryChanged()
}

export function pendingHashCount(): number {
  return countPendingHash()
}
