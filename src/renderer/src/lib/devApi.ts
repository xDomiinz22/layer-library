/**
 * API simulada para iterar la UI con `vite` a secas (sin Electron).
 * Solo se instala en desarrollo y cuando no existe el puente real.
 */
import type {
  FileDetail,
  LayerApi,
  LibraryRoot,
  ListFilesResult,
  ModelFile,
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

const HUES = [22, 210, 265, 140, 45]
function fakeThumb(i: number): string {
  const h = HUES[i % HUES.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 55% 62%)"/><stop offset="1" stop-color="hsl(${h} 45% 38%)"/></linearGradient></defs><rect width="200" height="200" fill="hsl(${h} 20% 14%)"/><circle cx="100" cy="105" r="${45 + (i % 5) * 8}" fill="url(#g)"/><rect x="60" y="150" width="80" height="10" rx="3" fill="hsl(${h} 30% 24%)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function mockFiles(n: number): ModelFile[] {
  return Array.from({ length: n }, (_, i) => {
    const name = NAMES[i % NAMES.length]
    const fmt = i % 3 === 0 ? '3mf' : 'stl'
    const status: ModelFile['thumbStatus'] =
      i % 7 === 3 ? 'pending' : i % 11 === 5 ? 'failed' : 'ready'
    return {
      id: i + 1,
      rootId: 1,
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
      dim: status === 'ready' ? [40 + i, 55 + (i % 7) * 4, 22 + (i % 5) * 6] : null
    } as ModelFile
  })
}

export function installDevApi(): void {
  if ((window as { api?: unknown }).api) return
  const files = mockFiles(37)
  const progressCbs: ((p: ScanProgress) => void)[] = []

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
    getStats: async () => ({
      totalFiles: 23944,
      totalSize: 412_000_000_000,
      byFormat: [
        { format: 'stl', count: 19800, size: 300e9 },
        { format: '3mf', count: 4144, size: 112e9 }
      ],
      pendingHash: 6210,
      pendingThumb: 23944,
      duplicateGroups: 380,
      duplicateFiles: 512,
      wastedBytes: 22_000_000_000
    }),
    listFiles: async (opts): Promise<ListFilesResult> => {
      const q = (opts.query ?? '').toLowerCase()
      let items = files.filter((f) => !q || f.name.toLowerCase().includes(q))
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
            : []
      }
    },
    revealInExplorer: async () => {},
    openFile: async () => {},
    copyText: async (t) => navigator.clipboard?.writeText(t).catch(() => {}),
    appVersion: async () => '0.0.0-dev',
    onScanProgress: (cb) => {
      progressCbs.push(cb)
      return () => progressCbs.splice(progressCbs.indexOf(cb), 1)
    },
    onLibraryChanged: () => () => {}
  }
  window.api = api
}
