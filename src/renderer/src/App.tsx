import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryRoot, LibraryStats, ModelFile, ScanProgress } from '@shared/types'
import { ModelGrid } from './components/ModelGrid'
import { CARD_SIZES, DEFAULT_FILTERS, FilterBar, type Filters } from './components/FilterBar'
import { DetailPanel } from './components/DetailPanel'
import { DuplicatesView } from './components/DuplicatesView'
import { QueueView } from './components/QueueView'
import { CollectionsView } from './components/CollectionsView'
import { GridSkeleton } from './components/Skeleton'
import { Toaster } from './components/Toaster'
import { DialogHost } from './components/DialogHost'
import { Logo } from './components/Logo'
import {
  CloseIcon,
  CollectionsIcon,
  DuplicateIcon,
  FolderPlusIcon,
  LibraryIcon,
  PrinterIcon,
  RefreshIcon,
  SearchIcon
} from './components/icons'
import { promptDialog } from './lib/dialog'
import { toast } from './lib/toast'
import { formatBytes, formatCount, relativeTime } from './lib/format'

type View = 'library' | 'duplicates' | 'queue' | 'collections'

const NAV: { id: View; Icon: typeof LibraryIcon; label: string }[] = [
  { id: 'library', Icon: LibraryIcon, label: 'Biblioteca' },
  { id: 'duplicates', Icon: DuplicateIcon, label: 'Duplicados' },
  { id: 'queue', Icon: PrinterIcon, label: 'Cola' },
  { id: 'collections', Icon: CollectionsIcon, label: 'Colecciones' }
]

function readActiveRoot(): number | null {
  const v = localStorage.getItem('activeRootId')
  return v && v !== 'null' ? Number(v) : null
}

export function App() {
  const [roots, setRoots] = useState<LibraryRoot[]>([])
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [queueCount, setQueueCount] = useState(0)
  const [files, setFiles] = useState<ModelFile[]>([])
  const [fileTotal, setFileTotal] = useState(0)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [activeRootId, setActiveRootId] = useState<number | null>(readActiveRoot)
  const [view, setView] = useState<View>('library')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState('')
  const [busy, setBusy] = useState(false)
  const [cardSize, setCardSize] = useState(() => {
    const v = Number(localStorage.getItem('cardSize'))
    return CARD_SIZES.includes(v) ? v : CARD_SIZES[1]
  })

  const reqRef = useRef({ query, filters, activeRootId })
  reqRef.current = { query, filters, activeRootId }

  const refreshRoots = useCallback(async () => {
    setRoots(await window.api.listRoots())
  }, [])

  const refreshFiles = useCallback(async () => {
    const { query: q, filters: f, activeRootId: rid } = reqRef.current
    const res = await window.api.listFiles({ query: q, ...f, rootId: rid, limit: 100000 })
    setFiles(res.items)
    setFileTotal(res.total)
  }, [])

  const refreshMeta = useCallback(async () => {
    await Promise.all([
      window.api.getStats(reqRef.current.activeRootId).then(setStats),
      window.api.listQueue().then((q) => setQueueCount(q.length))
    ])
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshRoots(), refreshMeta(), refreshFiles()])
    setLoading(false)
  }, [refreshRoots, refreshMeta, refreshFiles])

  useEffect(() => {
    void refreshAll()
    window.api.appVersion().then(setVersion)

    let t: ReturnType<typeof setTimeout> | null = null
    const offChanged = window.api.onLibraryChanged(() => {
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        void refreshRoots()
        void refreshMeta()
        void refreshFiles()
      }, 300)
    })
    const offProgress = window.api.onScanProgress((p) => {
      setProgress(p)
      if (p.phase === 'done' || p.phase === 'walking') void refreshRoots()
    })
    return () => {
      offChanged()
      offProgress()
      if (t) clearTimeout(t)
    }
  }, [refreshAll, refreshRoots, refreshMeta, refreshFiles])

  // Recarga lista + stats al cambiar búsqueda, filtros o biblioteca activa.
  useEffect(() => {
    const t = setTimeout(() => {
      void refreshFiles()
      void refreshMeta()
    }, 160)
    return () => clearTimeout(t)
  }, [query, filters, activeRootId, refreshFiles, refreshMeta])

  useEffect(() => {
    try {
      localStorage.setItem('cardSize', String(cardSize))
      localStorage.setItem('activeRootId', String(activeRootId))
    } catch {
      /* modo restringido */
    }
  }, [cardSize, activeRootId])

  const addRoot = useCallback(async () => {
    setBusy(true)
    try {
      const added = await window.api.addRoot()
      if (added) {
        setActiveRootId(added.id)
        await refreshAll()
      }
    } finally {
      setBusy(false)
    }
  }, [refreshAll])

  const removeRoot = useCallback(
    async (r: LibraryRoot) => {
      await window.api.removeRoot(r.id)
      setActiveRootId((cur) => (cur === r.id ? null : cur))
      toast(`Biblioteca “${r.label}” quitada`)
      await refreshAll()
    },
    [refreshAll]
  )

  const renameRoot = useCallback(
    async (r: LibraryRoot) => {
      const next = await promptDialog({
        title: 'Renombrar biblioteca',
        defaultValue: r.label,
        confirmLabel: 'Guardar'
      })
      if (next && next !== r.label) {
        await window.api.renameRoot(r.id, next)
        await refreshRoots()
      }
    },
    [refreshRoots]
  )

  const openLibrary = (rid: number | null): void => {
    setActiveRootId(rid)
    setView('library')
    setSelectedId(null)
  }

  const onlineCount = roots.filter((r) => r.online).length
  const walking = roots.some((r) => r.scanState === 'walking') || progress?.phase === 'walking'
  const working =
    walking ||
    progress?.phase === 'hashing' ||
    progress?.phase === 'thumbnails' ||
    progress?.phase === 'metadata' ||
    progress?.phase === 'slicing' ||
    (stats != null &&
      (stats.pendingHash > 0 || stats.pendingThumb > 0 || stats.pendingMeta > 0))
  const pct =
    progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : null

  const lastScan = roots.reduce<number | null>(
    (acc, r) => (r.lastScanAt && (!acc || r.lastScanAt > acc) ? r.lastScanAt : acc),
    null
  )
  const filtersActive =
    filters.formats.length > 0 || filters.dateWindow !== 'any' || filters.onlyDuplicates

  const activeRoot = roots.find((r) => r.id === activeRootId) ?? null
  const totalFileCount = roots.reduce((s, r) => s + r.fileCount, 0)

  const navBadge = (id: View): number =>
    id === 'duplicates' ? (stats?.duplicateGroups ?? 0) : id === 'queue' ? queueCount : 0

  return (
    <div className={`app${selectedId != null ? ' with-detail' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <Logo />
        </div>

        <nav className="nav">
          {NAV.map((n) => {
            const b = navBadge(n.id)
            const Icon = n.Icon
            return (
              <button
                key={n.id}
                className={`nav-item${view === n.id ? ' on' : ''}`}
                onClick={() => setView(n.id)}
              >
                <span className="nav-icon">
                  <Icon size={17} plain />
                </span>
                {n.label}
                {b > 0 && <span className="nav-badge">{b}</span>}
              </button>
            )
          })}
        </nav>

        <div className="side-section">
          <span>Bibliotecas</span>
          <span>{roots.length || ''}</span>
        </div>

        <div className="roots">
          {roots.length > 1 && (
            <div
              className={`root-item pick${view === 'library' && activeRootId == null ? ' on' : ''}`}
              onClick={() => openLibrary(null)}
            >
              <span className="dot all-dot" />
              <span className="meta">
                <div className="name">Todas las bibliotecas</div>
                <div className="sub">{formatCount(totalFileCount)} archivos</div>
              </span>
            </div>
          )}
          {roots.map((r) => (
            <div
              className={`root-item pick${view === 'library' && activeRootId === r.id ? ' on' : ''}`}
              key={r.id}
              onClick={() => openLibrary(r.id)}
              onDoubleClick={() => renameRoot(r)}
              title={r.path}
            >
              <span
                className={`dot${r.online ? '' : ' offline'}${r.scanState === 'walking' ? ' busy' : ''}`}
              />
              <span className="meta">
                <div className="name">{r.label}</div>
                <div className="sub">
                  {!r.online
                    ? 'Sin conexión'
                    : r.scanState === 'walking'
                      ? 'Escaneando…'
                      : `${formatCount(r.fileCount)} archivos`}
                </div>
              </span>
              <button
                className="kill"
                title="Quitar de la biblioteca"
                onClick={(e) => {
                  e.stopPropagation()
                  removeRoot(r)
                }}
              >
                <CloseIcon size={12} />
              </button>
            </div>
          ))}
          {!loading && roots.length === 0 && (
            <div className="roots-empty">Aún no has añadido carpetas.</div>
          )}
        </div>

        <div className="side-add">
          <button className="btn accent" onClick={addRoot} disabled={busy}>
            <FolderPlusIcon size={15} plain />
            Añadir carpeta
          </button>
        </div>

        <div className="side-foot">
          <span>v{version || '0.0.0'}</span>
          <span>100% local</span>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          {view === 'library' ? (
            <div className="search">
              <SearchIcon size={15} className="search-ic" />
              <input
                placeholder={
                  activeRoot ? `Buscar en ${activeRoot.label}…` : 'Buscar en todas las bibliotecas…'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="search-clear" onClick={() => setQuery('')} title="Limpiar">
                  <CloseIcon size={12} />
                </button>
              )}
            </div>
          ) : (
            <span className="topbar-title">{NAV.find((n) => n.id === view)?.label}</span>
          )}
          <div className="topbar-right">
            {working ? (
              <span className="pill live">
                <span className="spinner" />
                {progress?.message ?? 'Trabajando…'}
              </span>
            ) : (
              roots.length > 0 &&
              view === 'library' && (
                <button
                  className="btn ghost"
                  onClick={() =>
                    activeRootId != null
                      ? window.api.rescanRoot(activeRootId)
                      : window.api.rescanAll()
                  }
                  title={activeRoot ? `Reescanear ${activeRoot.label}` : 'Volver a escanear todo'}
                >
                  <RefreshIcon size={14} plain />
                  Reescanear
                </button>
              )
            )}
          </div>
        </div>

        {working && (
          <div className="progressbar">
            <div
              className={`progressbar-fill${pct == null ? ' indeterminate' : ''}`}
              style={pct == null ? undefined : { transform: `scaleX(${pct / 100})` }}
            />
          </div>
        )}

        {roots.length === 0 ? (
          <div className="empty">
            <div className="empty-card">
              <div className="empty-illo">🗂️</div>
              <h1>Tu colección de impresión 3D, por fin ordenada</h1>
              <p>
                Añade las carpetas donde guardas tus modelos — disco local, unidad externa o NAS.
                Cada carpeta es una biblioteca independiente que puedes ver por separado.
              </p>
              <button className="btn accent" onClick={addRoot} disabled={busy}>
                <FolderPlusIcon size={16} plain />
                Añadir la primera carpeta
              </button>
              <div className="hint">Nada sale de tu equipo. No se mueven ni renombran archivos.</div>
            </div>
          </div>
        ) : view === 'duplicates' ? (
          <div className="view" key="duplicates">
            <DuplicatesView />
          </div>
        ) : view === 'queue' ? (
          <div className="view" key="queue">
            <QueueView onSelect={setSelectedId} />
          </div>
        ) : view === 'collections' ? (
          <div className="view" key="collections">
            <CollectionsView
              cardSize={cardSize}
              selectedFileId={selectedId}
              onSelectFile={setSelectedId}
            />
          </div>
        ) : (
          <div className="view" key={`library-${activeRootId}`}>
            <div className="stat-strip">
              {activeRoot && <span className="strip-scope">📁 {activeRoot.label}</span>}
              <span>
                <b>{formatCount(stats?.totalFiles ?? 0)}</b> archivos
              </span>
              <span>
                <b>{formatBytes(stats?.totalSize ?? 0)}</b> en disco
              </span>
              {(stats?.byFormat ?? []).map((f) => (
                <span key={f.format}>
                  <b>{formatCount(f.count)}</b> {f.format.toUpperCase()}
                </span>
              ))}
              {stats != null && stats.pendingThumb > 0 && (
                <span className="strip-muted">
                  <b>{formatCount(stats.pendingThumb)}</b> sin miniatura
                </span>
              )}
              <span className="strip-spacer" />
              <span className="strip-muted">
                {onlineCount}/{roots.length} en línea · escaneo {relativeTime(lastScan)}
              </span>
            </div>

            <FilterBar
              filters={filters}
              onChange={setFilters}
              formats={(stats?.byFormat ?? []).map((x) => x.format)}
              cardSize={cardSize}
              onCardSize={setCardSize}
              count={fileTotal}
            />

            {loading && files.length === 0 ? (
              <GridSkeleton size={cardSize} />
            ) : files.length === 0 ? (
              <div className="list-empty">
                {query || filtersActive
                  ? 'Ningún archivo coincide con la búsqueda.'
                  : walking
                    ? 'Escaneando… los archivos aparecerán aquí.'
                    : activeRoot
                      ? `${activeRoot.label} no tiene modelos indexados todavía.`
                      : 'No se han encontrado modelos en estas carpetas.'}
              </div>
            ) : (
              <ModelGrid
                files={files}
                size={cardSize}
                selectedId={selectedId}
                onSelect={(f) => setSelectedId((cur) => (cur === f.id ? null : f.id))}
              />
            )}
          </div>
        )}
      </main>

      <DetailPanel fileId={selectedId} onClose={() => setSelectedId(null)} onTrashed={refreshAll} />
      <Toaster />
      <DialogHost />
    </div>
  )
}
