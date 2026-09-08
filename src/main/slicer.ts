import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { getFileRowById, setSlicedPrintInfoByHash } from './db'
import { emitLibraryChanged, emitScanProgress } from './emit'

/**
 * Relamina un 3MF/gcode con Bambu Studio (u OrcaSlicer) en modo consola para
 * obtener tiempo y gramos cuando el archivo no los trae. El slicer usa los
 * ajustes embebidos en el propio 3MF; no abre ventana ni toca el original.
 */

const CANDIDATES = [
  process.env.LAYERLIB_SLICER,
  'C:\\Program Files\\Bambu Studio\\bambu-studio.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Bambu Studio', 'bambu-studio.exe'),
  'C:\\Program Files\\OrcaSlicer\\orca-slicer.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'OrcaSlicer', 'orca-slicer.exe'),
  '/Applications/BambuStudio.app/Contents/MacOS/BambuStudio',
  '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer'
].filter((p): p is string => !!p)

let cachedPath: string | null | undefined

export function slicerPath(): string | null {
  if (cachedPath !== undefined) return cachedPath
  cachedPath = CANDIDATES.find((p) => existsSync(p)) ?? null
  return cachedPath
}

export function slicerAvailable(): boolean {
  return slicerPath() != null
}

const SLICE_TIMEOUT = 12 * 60_000

interface SliceResultJson {
  return_code: number
  error_string?: string
  sliced_plates?: {
    total_predication?: number
    filaments?: { total_used_g?: number }[]
  }[]
}

interface SliceStats {
  seconds: number | null
  grams: number | null
  plates: number | null
}

async function runSlice(exe: string, file: string): Promise<SliceStats | null> {
  const out = await mkdtemp(join(app.getPath('temp'), 'll-slice-'))
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(exe, ['--slice', '0', '--outputdir', out, file], {
        windowsHide: true,
        stdio: 'ignore'
      })
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('timeout'))
      }, SLICE_TIMEOUT)
      child.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
      child.on('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })

    const raw = await readFile(join(out, 'result.json'), 'utf8').catch(() => null)
    if (!raw) return null
    const j = JSON.parse(raw) as SliceResultJson
    if (j.return_code !== 0 || !j.sliced_plates?.length) return null

    let seconds = 0
    let grams = 0
    for (const p of j.sliced_plates) {
      seconds += Math.round(p.total_predication ?? 0)
      for (const f of p.filaments ?? []) grams += f.total_used_g ?? 0
    }
    return {
      seconds: seconds > 0 ? seconds : null,
      grams: grams > 0 ? Math.round(grams * 10) / 10 : null,
      plates: j.sliced_plates.length
    }
  } finally {
    await rm(out, { recursive: true, force: true }).catch(() => {})
  }
}

// --- Cola (un laminado a la vez: usa toda la CPU) --------------------

export interface SliceOutcome {
  ok: boolean
  error?: string
}

const queue: number[] = []
const waiting = new Map<number, ((r: SliceOutcome) => void)[]>()
let active = false

export function sliceForStats(id: number): Promise<SliceOutcome> {
  return new Promise((resolve) => {
    const arr = waiting.get(id) ?? []
    arr.push(resolve)
    waiting.set(id, arr)
    if (!queue.includes(id)) queue.push(id)
    void pump()
  })
}

function settle(id: number, r: SliceOutcome): void {
  for (const resolve of waiting.get(id) ?? []) resolve(r)
  waiting.delete(id)
}

async function pump(): Promise<void> {
  if (active) return
  active = true
  const exe = slicerPath()
  try {
    while (queue.length) {
      const id = queue.shift()!
      const row = getFileRowById(id)

      if (!row || !row.hash || (row.format !== '3mf' && row.format !== 'gcode')) {
        settle(id, { ok: false, error: 'Este archivo no se puede relaminar.' })
        continue
      }
      if (!exe) {
        settle(id, { ok: false, error: 'No se encontró Bambu Studio ni OrcaSlicer.' })
        continue
      }
      try {
        await stat(row.path)
      } catch {
        settle(id, { ok: false, error: 'El archivo ya no está disponible.' })
        continue
      }

      emitScanProgress({
        rootId: null,
        phase: 'slicing',
        discovered: 0,
        processed: 0,
        total: queue.length + 1,
        message: `Laminando ${row.name}…`
      })

      try {
        const stats = await runSlice(exe, row.path)
        if (stats && (stats.seconds != null || stats.grams != null)) {
          setSlicedPrintInfoByHash(row.hash, stats)
          settle(id, { ok: true })
        } else {
          settle(id, { ok: false, error: 'El laminado no devolvió tiempo ni gramos.' })
        }
      } catch (e) {
        const msg =
          e instanceof Error && e.message === 'timeout'
            ? 'El laminado tardó demasiado y se canceló.'
            : 'No se pudo laminar el archivo.'
        settle(id, { ok: false, error: msg })
      }
      emitLibraryChanged()
    }
  } finally {
    active = false
    emitScanProgress({ rootId: null, phase: 'done', discovered: 0, processed: 0, total: 0 })
  }
}
