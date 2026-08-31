import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { app, BrowserWindow, ipcMain } from 'electron'
import {
  findThumbByHash,
  selectPendingThumbFiles,
  setThumbResult,
  setThumbResultByHash,
  type PendingThumb
} from './db'
import { emitLibraryChanged, emitScanProgress } from './emit'
import { extract3mfThumbnail } from './threemf'
import type { MeshMeta } from '../shared/types'

interface RenderResult {
  png: Buffer
  meta: MeshMeta | null
}

const MAX_BYTES = 220 * 1024 * 1024
const JOB_TIMEOUT = 25_000

function thumbDir(): string {
  return join(app.getPath('userData'), 'thumbnails')
}

export function thumbFilePath(file: string): string {
  return join(thumbDir(), file)
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
          format: job.format === '3mf' ? '3mf' : 'stl',
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
  if (st.size > MAX_BYTES) {
    setThumbResultByHash(f.hash, 'failed', null)
    return
  }

  const raw = await readFile(f.path)

  // 3MF: intenta la miniatura embebida del slicer antes de renderizar.
  if (f.format === '3mf') {
    const png = extract3mfThumbnail(raw)
    if (png) {
      await writeFile(cachePath, png)
      setThumbResultByHash(f.hash, 'ready', cacheName)
      return
    }
  }

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
