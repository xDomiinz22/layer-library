/**
 * API simulada para iterar la UI con `vite` a secas (sin Electron).
 * Solo se instala en desarrollo y cuando no existe el puente real.
 */
import type {
  Collection,
  FileDetail,
  LayerApi,
  LibraryRoot,
  ListFilesResult,
  ModelFile,
  Printer,
  QueueItem,
  ScanProgress
} from '@shared/types'

function mockRoots(): LibraryRoot[] {
  return [
    {
      id: 1,
      path: 'Z:\\Modelos\\Descargas',
      label: 'Descargas',
      kind: 'local',
      online: true,
      addedAt: Date.now() - 8.64e7,
      lastScanAt: Date.now() - 6e5,
      fileCount: 4213,
      scanState: 'idle'
    },
    {
      id: 2,
      path: '\\\\NAS\\prints',
      label: 'NAS prints',
      kind: 'network',
      online: true,
      addedAt: Date.now() - 3e8,
      lastScanAt: Date.now() - 9e6,
      fileCount: 18740,
      scanState: 'walking'
    },
    {
      id: 3,
      path: 'E:\\STL backup',
      label: 'Disco E:',
      kind: 'external',
      online: false,
      addedAt: Date.now() - 9e8,
      lastScanAt: Date.now() - 8.64e8,
      fileCount: 991,
      scanState: 'idle'
    }
  ]
}

const NAMES = [
  'articulated_dragon',
  'flexi_axolotl',
  'benchy',
  'calibration_cube',
  'gridfinity_bin_2x1',
  'low_poly_pikachu',
  'skull_planter',
  'phone_stand_v3',
  'dragon_egg',
  'castle_keep'
]

const HUES = [78, 258, 345, 190, 40]
function fakeThumb(i: number): string {
  const h = HUES[i % HUES.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 55% 62%)"/><stop offset="1" stop-color="hsl(${h} 45% 38%)"/></linearGradient></defs><rect width="200" height="200" fill="hsl(${h} 20% 14%)"/><circle cx="100" cy="105" r="${45 + (i % 5) * 8}" fill="url(#g)"/><rect x="60" y="150" width="80" height="10" rx="3" fill="hsl(${h} 30% 24%)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const FORMATS = ['stl', 'stl', 'stl', '3mf', '3mf', 'obj', 'gcode', 'step'] as const
const FIL_TYPES = ['PLA', 'PETG', 'PLA-CF', 'TPU', 'ABS']
const FIL_COLORS = ['#1B1B1B', '#E7402A', '#2F6DF0', '#F4B60B', '#19A974', '#8E44EC']

function mockFiles(n: number): ModelFile[] {
  return Array.from({ length: n }, (_, i) => {
    const name = NAMES[i % NAMES.length]
    const fmt = FORMATS[i % FORMATS.length]
    const status: ModelFile['thumbStatus'] =
      i % 7 === 3 ? 'pending' : i % 11 === 5 ? 'failed' : 'ready'
    const rootId = (i % 3) + 1
    const hasPrint = (fmt === '3mf' || fmt === 'gcode') && status === 'ready'
    const plates = fmt === '3mf' ? (i % 3) + 1 : 1
    return {
      id: i + 1,
      rootId,
      path: `Z:\\Modelos\\Descargas\\${name}.${fmt}`,
      relPath: `${i % 2 ? 'dragons/' : ''}${name}.${fmt}`,
      name: `${name}.${fmt}`,
      format: fmt,
      size: 1_200_000 + i * 350_000,
      mtimeMs: Date.now() - i * 3.6e6,
      hash: i % 4 === 0 ? null : `deadbeef${i}`,
      thumbStatus: status,
      thumbFile: status === 'ready' ? fakeThumb(i) : null,
      addedAt: Date.now() - i * 3.6e6,
      triCount: status === 'ready' ? 12000 + i * 3100 : null,
      dim: status === 'ready' ? [40 + i, 55 + (i % 7) * 4, 22 + (i % 5) * 6] : null,
      printSeconds: hasPrint ? plates * (2400 + (i % 6) * 1300) : null,
      filamentG: hasPrint ? plates * (14 + (i % 9) * 7.5) : null,
      filamentTypes: hasPrint ? FIL_TYPES.slice(0, 1 + (i % 3)) : [],
      filamentColors: hasPrint ? FIL_COLORS.slice(i % 3, (i % 3) + 1 + (i % 4)) : [],
      plateCount: fmt === '3mf' && hasPrint ? plates : null,
      printSource: hasPrint ? 'file' : null
    } as ModelFile
  })
}

export function installDevApi(): void {
  if ((window as { api?: unknown }).api) return
  const files = mockFiles(37)
  const progressCbs: ((p: ScanProgress) => void)[] = []

  const collections: Collection[] = [
    { id: 1, name: 'Para regalar', kind: 'collection', fileCount: 0 },
    { id: 2, name: 'Cults3D — Fotis', kind: 'creator', fileCount: 0 }
  ]
  let collId = 2
  const collFiles: { fileId: number; cid: number }[] = []
  const printers: Printer[] = [
    { id: 1, name: 'Bambu A1' },
    { id: 2, name: 'Ender 3' }
  ]
  let printerId = 2
  const queue: QueueItem[] = []
  let queueId = 0
  const changeCbs: (() => void)[] = []
  const fire = (): void => {
    for (const cb of changeCbs.slice()) cb()
  }

  setInterval(() => {
    const processed = Math.floor(Math.random() * 12000)
    for (const cb of progressCbs)
      cb({
        rootId: 2,
        phase: 'hashing',
        discovered: 0,
        processed,
        total: 12000,
        message: `Calculando huellas… ${processed}/12000`
      })
  }, 1500)

  const api: LayerApi = {
    listRoots: async () => mockRoots(),
    addRoot: async () => null,
    addRootPath: async () => null,
    removeRoot: async () => {},
    renameRoot: async () => {},
    rescanAll: async () => {},
    rescanRoot: async () => {},
    getStats: async (rootId) => {
      const scope = rootId != null ? files.filter((f) => f.rootId === rootId) : files
      const byFmt: Record<string, { count: number; size: number }> = {}
      for (const f of scope) {
        byFmt[f.format] ??= { count: 0, size: 0 }
        byFmt[f.format].count++
        byFmt[f.format].size += f.size
      }
      return {
        totalFiles: scope.length,
        totalSize: scope.reduce((s, f) => s + f.size, 0),
        byFormat: Object.entries(byFmt).map(([format, v]) => ({
          format: format as ModelFile['format'],
          ...v
        })),
        pendingHash: 6,
        pendingThumb: scope.filter((f) => f.thumbStatus !== 'ready').length,
        pendingMeta: 0,
        duplicateGroups: 3,
        duplicateFiles: 3,
        wastedBytes: 22_000_000
      }
    },
    listFiles: async (opts): Promise<ListFilesResult> => {
      const q = (opts.query ?? '').toLowerCase()
      let items = files.filter((f) => !q || f.name.toLowerCase().includes(q))
      if (opts.rootId != null) items = items.filter((f) => f.rootId === opts.rootId)
      if (opts.formats && opts.formats.length) {
        items = items.filter((f) => opts.formats!.includes(f.format))
      }
      if (opts.onlyDuplicates) items = items.filter((_, i) => i % 3 === 0)
      return { items: items.slice(0, opts.limit ?? 100000), total: items.length }
    },
    getFileDetail: async (id): Promise<FileDetail | null> => {
      const file = files.find((f) => f.id === id)
      if (!file) return null
      return {
        file,
        rootLabel: 'Descargas',
        rootPath: 'Z:\\Modelos\\Descargas',
        duplicates:
          id % 3 === 0
            ? [
                { id: 999, path: 'E:\\backup\\copy.stl', relPath: 'backup/copy.stl', rootLabel: 'Disco E:' }
              ]
            : [],
        collectionIds: collFiles.filter((cf) => cf.fileId === id).map((cf) => cf.cid),
        inQueue: queue.some((q) => q.file.id === id)
      }
    },
    slicerAvailable: async () => true,
    sliceForStats: async (id) => {
      await new Promise((r) => setTimeout(r, 1200))
      const fl = files.find((x) => x.id === id)
      if (fl) {
        fl.printSeconds = 3600 + (id % 5) * 900
        fl.filamentG = 22 + (id % 7) * 6
        fl.plateCount = fl.plateCount ?? 1
        fl.printSource = 'sliced'
        fire()
      }
      return { ok: true }
    },
    revealInExplorer: async () => {},
    openFile: async () => {},
    copyText: async (t) => navigator.clipboard?.writeText(t).catch(() => {}),
    trashFiles: async (ids) => {
      for (const id of ids) {
        const i = files.findIndex((f) => f.id === id)
        if (i >= 0) files.splice(i, 1)
      }
      return ids.length
    },
    listDuplicateGroups: async () => {
      const groups = []
      for (let i = 0; i + 1 < files.length && groups.length < 6; i += 2) {
        const a = files[i]
        const b = files[i + 1]
        groups.push({
          hash: 'h' + a.id,
          size: a.size,
          wasted: a.size,
          thumbFile: a.thumbFile,
          members: [
            { id: a.id, path: a.path, relPath: a.relPath, rootId: 1, rootLabel: 'Descargas', mtimeMs: a.mtimeMs },
            { id: b.id, path: b.path, relPath: 'copias/' + b.name, rootId: 3, rootLabel: 'Disco E:', mtimeMs: b.mtimeMs }
          ]
        })
      }
      return groups
    },
    listCollections: async () => collections.slice(),
    createCollection: async (name, kind) => {
      const c = { id: ++collId, name, kind, fileCount: 0 }
      collections.push(c)
      return c
    },
    renameCollection: async (id, name) => {
      const c = collections.find((x) => x.id === id)
      if (c) c.name = name
    },
    deleteCollection: async (id) => {
      const i = collections.findIndex((x) => x.id === id)
      if (i >= 0) collections.splice(i, 1)
    },
    setFileCollection: async (fileId, cid, member) => {
      if (member) collFiles.push({ fileId, cid })
      else {
        const i = collFiles.findIndex((x) => x.fileId === fileId && x.cid === cid)
        if (i >= 0) collFiles.splice(i, 1)
      }
      const c = collections.find((x) => x.id === cid)
      if (c) c.fileCount = collFiles.filter((x) => x.cid === cid).length
    },
    listCollectionFiles: async (cid) =>
      collFiles.filter((cf) => cf.cid === cid).map((cf) => files.find((f) => f.id === cf.fileId)!).filter(Boolean),
    listPrinters: async () => printers.slice(),
    createPrinter: async (name) => {
      const p = { id: ++printerId, name }
      printers.push(p)
      return p
    },
    renamePrinter: async (id, name) => {
      const p = printers.find((x) => x.id === id)
      if (p) p.name = name
    },
    deletePrinter: async (id) => {
      const i = printers.findIndex((x) => x.id === id)
      if (i >= 0) printers.splice(i, 1)
      queue.forEach((q) => {
        if (q.printerId === id) q.printerId = null
      })
    },
    listQueue: async () => queue.map((q) => ({ ...q })),
    addToQueue: async (fileId, printerId) => {
      if (!queue.some((q) => q.file.id === fileId)) {
        const f = files.find((x) => x.id === fileId)
        if (f) queue.push({ id: ++queueId, file: f, printerId, sort: queue.length, printed: false, addedAt: Date.now() })
      }
    },
    toggleQueue: async (fileId) => {
      const i = queue.findIndex((q) => q.file.id === fileId)
      if (i >= 0) {
        queue.splice(i, 1)
        return false
      }
      const f = files.find((x) => x.id === fileId)
      if (f) queue.push({ id: ++queueId, file: f, printerId: null, sort: queue.length, printed: false, addedAt: Date.now() })
      return true
    },
    removeFromQueue: async (itemId) => {
      const i = queue.findIndex((q) => q.id === itemId)
      if (i >= 0) queue.splice(i, 1)
    },
    updateQueueItem: async (itemId, patch) => {
      const q = queue.find((x) => x.id === itemId)
      if (!q) return
      if (patch.printerId !== undefined) q.printerId = patch.printerId
      if (patch.printed !== undefined) q.printed = patch.printed
    },
    moveQueueItem: async (itemId, dir) => {
      const i = queue.findIndex((q) => q.id === itemId)
      const j = dir === 'up' ? i - 1 : i + 1
      if (i >= 0 && j >= 0 && j < queue.length) {
        ;[queue[i], queue[j]] = [queue[j], queue[i]]
      }
    },
    appVersion: async () => '0.0.0-dev',
    getUpdateState: async () => ({ phase: 'idle' as const }),
    checkForUpdate: async () => {},
    installUpdate: async () => {},
    onUpdateState: () => () => {},
    onScanProgress: (cb) => {
      progressCbs.push(cb)
      return () => progressCbs.splice(progressCbs.indexOf(cb), 1)
    },
    onLibraryChanged: (cb) => {
      changeCbs.push(cb)
      return () => changeCbs.splice(changeCbs.indexOf(cb), 1)
    }
  }

  // Notifica cambios tras cualquier mutación (imita emitLibraryChanged del proceso principal).
  for (const k of [
    'trashFiles',
    'createCollection',
    'renameCollection',
    'deleteCollection',
    'setFileCollection',
    'createPrinter',
    'renamePrinter',
    'deletePrinter',
    'addToQueue',
    'toggleQueue',
    'removeFromQueue',
    'updateQueueItem',
    'moveQueueItem'
  ] as const) {
    const bag = api as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>
    const orig = bag[k]
    bag[k] = async (...a: unknown[]) => {
      const r = await orig(...a)
      fire()
      return r
    }
  }

  window.api = api
}
