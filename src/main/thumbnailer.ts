import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { app, BrowserWindow, ipcMain } from 'electron'
import { open } from 'node:fs/promises'
import {
  findThumbByHash,
  getDb,
  selectPendingThumbFiles,
  setThumbResult,
  setThumbResultByHash,
  type PendingThumb
} from './db'
import { emitLibraryChanged, emitScanProgress } from './emit'
import { extract3mfThumbnail } from './threemf'
import { extractGcodeThumbnail } from './gcode'
import type { MeshMeta } from '../shared/types'

interface RenderResult {
  png: Buffer
  meta: MeshMeta | null
}

/** Tope para el render 3D (STL/OBJ/3MF sin miniatura). */
const MAX_RENDER_BYTES = 220 * 1024 * 1024
/** Tope para descomprimir un 3MF y sacar su PNG embebida. */
const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024
const JOB_TIMEOUT = 25_000

/** Lee los primeros y últimos `n` bytes de un archivo (para buscar miniaturas en G-code grandes). */
async function readHeadTail(path: string, n: number, size: number): Promise<Buffer> {
  const fh = await open(path, 'r')
  try {
    if (size <= n * 2) {
      const b = Buffer.alloc(size)
      await fh.read(b, 0, size, 0)
      return b
    }
    const head = Buffer.alloc(n)
    const tail = Buffer.alloc(n)
    await fh.read(head, 0, n, 0)
    await fh.read(tail, 0, n, size - n)
    return Buffer.concat([head, tail])
  } finally {
    await fh.close()
  }
}

function thumbDir(): string {
  return join(app.getPath('userData'), 'thumbnails')
}

export function thumbFilePath(file: string): string {
  return join(thumbDir(), file)
}

/** Borra de la caché las miniaturas cuyo hash ya no referencia ningún archivo. */
export async function pruneThumbnailCache(): Promise<number> {
  let names: string[]
  try {
    names = await readdir(thumbDir())
  } catch {
    return 0
  }
  const pngs = names.filter((n) => n.endsWith('.png'))
  if (pngs.length === 0) return 0

  const live = new Set(
    (
      getDb().prepare('SELECT DISTINCT hash FROM files WHERE hash IS NOT NULL').all() as unknown as {
        hash: string
      }[]
    ).map((r) => `${r.hash}.png`)
  )

  let removed = 0
  for (const n of pngs) {
    if (!live.has(n)) {
      try {
        await rm(join(thumbDir(), n))
        removed++
      } catch {
        /* en uso */
      }
    }
  }
  return removed
}

// --- Ventana oculta de render ----------------------------------------

let win: BrowserWindow | null = null
let ready: Promise<BrowserWindow> | null = null
const jobs = new Map<
  number,
  { resolve: (r: RenderResult) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
>()

function wireIpcOnce(): void {
  ipcMain.on(
    'thumb:done',
    (_e, { id, pngBase64, meta }: { id: number; pngBase64: string; meta: MeshMeta | null }) => {
      const j = jobs.get(id)
      if (!j) return
      clearTimeout(j.timer)
      jobs.delete(id)
      j.resolve({ png: Buffer.from(pngBase64, 'base64'), meta: meta ?? null })
    }
  )
  ipcMain.on('thumb:fail', (_e, { id, error }: { id: number; error: string }) => {
    const j = jobs.get(id)
    if (!j) return
    clearTimeout(j.timer)
    jobs.delete(id)
    j.reject(new Error(error))
  })
}
let ipcWired = false

function getThumber(): Promise<BrowserWindow> {
  if (ready) return ready
  if (!ipcWired) {
    wireIpcOnce()
    ipcWired = true
  }
  ready = new Promise((resolve, reject) => {
    const w = new BrowserWindow({
      show: false,
      width: 640,
      height: 640,
      webPreferences: {
        preload: join(__dirname, '../preload/thumber.js'),
        offscreen: false,
        backgroundThrottling: false
      }
    })
    win = w
    w.on('closed', () => {
      win = null
      ready = null
    })

    const onReady = (): void => resolve(w)
    ipcMain.once('thumb:ready', onReady)

    const url = process.env.ELECTRON_RENDERER_URL
    const load = url
      ? w.loadURL(`${url}/thumber.html`)
      : w.loadFile(join(__dirname, '../renderer/thumber.html'))
    load.catch(reject)

    setTimeout(() => reject(new Error('thumber no respondió')), 15_000)
  })
  return ready
}

function renderInWindow(
  job: PendingThumb,
  buffer: ArrayBuffer,
  size: number
): Promise<RenderResult> {
  return getThumber().then(
    (w) =>
      new Promise<RenderResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          jobs.delete(job.id)
          reject(new Error('timeout de render'))
        }, JOB_TIMEOUT)
        jobs.set(job.id, { resolve, reject, timer })
        w.webContents.send('thumb:job', {
          id: job.id,
          format: job.format === '3mf' ? '3mf' : job.format === 'obj' ? 'obj' : 'stl',
          buffer,
          size
        })
      })
  )
}

// --- Cola -----------------------------------------------------------

let running = false
let rerun = false

async function processOne(f: PendingThumb): Promise<void> {
  const cacheName = `${f.hash}.png`
  const cachePath = thumbFilePath(cacheName)

  if (existsSync(cachePath)) {
    setThumbResultByHash(f.hash, 'ready', cacheName)
    return
  }
  const sibling = findThumbByHash(f.hash)
  if (sibling && existsSync(thumbFilePath(sibling))) {
    setThumbResultByHash(f.hash, 'ready', sibling)
    return
  }

  let st
  try {
    st = await stat(f.path)
  } catch {
    setThumbResult(f.id, 'failed', null)
    return
  }

  // STEP: se indexa pero no se genera vista previa (requiere kernel CAD).
  if (f.format === 'step') {
    setThumbResultByHash(f.hash, 'failed', null)
    return
  }

  // G-code: solo miniatura embebida por el slicer (no renderizamos toolpaths).
  // El tamaño no importa: leemos solo cabecera y cola.
  if (f.format === 'gcode') {
    try {
      const png = extractGcodeThumbnail(await readHeadTail(f.path, 1_500_000, st.size))
      if (png) {
        await writeFile(cachePath, png)
        setThumbResultByHash(f.hash, 'ready', cacheName)
      } else {
        setThumbResultByHash(f.hash, 'failed', null)
      }
    } catch {
      setThumbResultByHash(f.hash, 'failed', null)
    }
    return
  }

  // 3MF: la miniatura embebida del slicer se extrae SIN límite de tamaño
  // (descomprimir solo el PNG de un zip enorme es barato). El render 3D sí tiene tope.
  if (f.format === '3mf') {
    if (st.size <= MAX_ZIP_BYTES) {
      try {
        const png = extract3mfThumbnail(await readFile(f.path))
        if (png) {
          await writeFile(cachePath, png)
          setThumbResultByHash(f.hash, 'ready', cacheName)
          return
        }
      } catch {
        /* zip corrupto o sin memoria: cae al render si cabe */
      }
    }
  }

  if (st.size > MAX_RENDER_BYTES) {
    setThumbResultByHash(f.hash, 'failed', null)
    return
  }

  const raw = await readFile(f.path)
  const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  try {
    const { png, meta } = await renderInWindow(f, ab, st.size)
    await writeFile(cachePath, png)
    setThumbResultByHash(f.hash, 'ready', cacheName, meta)
  } catch {
    setThumbResultByHash(f.hash, 'failed', null)
  }
}

export async function thumbnailPending(): Promise<void> {
  if (running) {
    rerun = true
    return
  }
  running = true
  try {
    await mkdir(thumbDir(), { recursive: true })
    do {
      rerun = false
      const pending = selectPendingThumbFiles()
      const total = pending.length
      if (total === 0) break

      let processed = 0
      for (const f of pending) {
        await processOne(f)
        processed++
        if (processed % 8 === 0 || processed === total) {
          emitScanProgress({
            rootId: null,
            phase: 'thumbnails',
            discovered: 0,
            processed,
            total,
            message: `Generando miniaturas… ${processed.toLocaleString('es')}/${total.toLocaleString('es')}`
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

  // Libera la ventana de render si ya no hay trabajo.
  if (win && !win.isDestroyed()) {
    win.close()
    win = null
    ready = null
  }
}
