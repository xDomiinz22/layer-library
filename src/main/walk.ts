import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModelFormat } from '../shared/types'
import { SCANNED_FORMATS } from '../shared/types'

/** Carpetas que no aportan modelos y suelen ser enormes o cíclicas. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '$RECYCLE.BIN',
  'System Volume Information',
  'found.000',
  '#recycle', // Synology
  '@eaDir', // Synology (miniaturas)
  '.Trashes',
  '.Spotlight-V100',
  '.cache',
  '__MACOSX'
])

export function formatOf(name: string): ModelFormat | null {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return null
  const ext = name.slice(dot + 1).toLowerCase() as ModelFormat
  return SCANNED_FORMATS.includes(ext) ? ext : null
}

export interface WalkHit {
  path: string
  name: string
  format: ModelFormat
  size: number
  mtimeMs: number
}

/**
 * Recorrido recursivo de `root`. No sigue enlaces simbólicos a directorios
 * (evita ciclos). Los errores por carpeta inaccesible se ignoran.
 */
export async function* walk(root: string): AsyncGenerator<WalkHit> {
  const stack: string[] = [root]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue
        stack.push(full)
      } else if (e.isFile()) {
        const format = formatOf(e.name)
        if (!format) continue
        try {
          const s = await stat(full)
          yield { path: full, name: e.name, format, size: s.size, mtimeMs: s.mtimeMs }
        } catch {
          /* archivo desaparecido entre readdir y stat */
        }
      }
    }
  }
}
