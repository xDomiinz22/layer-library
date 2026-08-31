import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryRoot, LibraryStats, ModelFile, ScanProgress } from '@shared/types'
import { ModelGrid } from './components/ModelGrid'
import { CARD_SIZES, DEFAULT_FILTERS, FilterBar, type Filters } from './components/FilterBar'
import { DetailPanel } from './components/DetailPanel'
import { formatBytes, formatCount, relativeTime } from './lib/format'

export function App() {
  const [roots, setRoots] = useState<LibraryRoot[]>([])
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [files, setFiles] = useState<ModelFile[]>([])
  const [fileTotal, setFileTotal] = useState(0)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState('')
  const [busy, setBusy] = useState(false)
  const [cardSize, setCardSize] = useState(() => {
    const v = Number(localStorage.getItem('cardSize'))
    return CARD_SIZES.includes(v) ? v : CARD_SIZES[1]
  })

  const reqRef = useRef({ query, filters })
  reqRef.current = { query, filters }

  const refreshRoots = useCallback(async () => {
    setRoots(await window.api.listRoots())
  }, [])

  const refreshFiles = useCallback(async () => {
    const { query: q, filters: f } = reqRef.current
    const res = await window.api.listFiles({ query: q, ...f, limit: 100000 })
    setFiles(res.items)
    setFileTotal(res.total)
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshRoots(),
      window.api.getStats().then(setStats),
      refreshFiles()
    ])
    setLoading(false)
  }, [refreshRoots, refreshFiles])

  useEffect(() => {
    void refreshAll()
    window.api.appVersion().then(setVersion)

    let t: ReturnType<typeof setTimeout> | null = null
    const offChanged = window.api.onLibraryChanged(() => {
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        void refreshRoots()
        void window.api.getStats().then(setStats)
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
  }, [refreshAll, refreshRoots, refreshFiles])

  // Recarga la lista al cambiar búsqueda o filtros (con debounce en la búsqueda).
  useEffect(() => {
    const t = setTimeout(() => void refreshFiles(), 180)
    return () => clearTimeout(t)
  }, [query, filters, refreshFiles])

  useEffect(() => {
    try {
      localStorage.setItem('cardSize', String(cardSize))
    } catch {
      /* modo restringido */
    }
  }, [cardSize])

  const addRoot = useCallback(async () => {
    setBusy(true)
    try {
      const added = await window.api.addRoot()
      if (added) await refreshAll()
    } finally {
      setBusy(false)
    }
  }, [refreshAll])

  const removeRoot = useCallback(
    async (r: LibraryRoot) => {
      await window.api.removeRoot(r.id)
      await refreshAll()
    },
    [refreshAll]
  )

  const renameRoot = useCallback(
    async (r: LibraryRoot) => {
      const next = window.prompt('Nombre de la biblioteca', r.label)
      if (next && next.trim() && next !== r.label) {
        await window.api.renameRoot(r.id, next.trim())
        await refreshRoots()
      }
    },
    [refreshRoots]
  )

  const onlineCount = roots.filter((r) => r.online).length
  const walking = roots.some((r) => r.scanState === 'walking') || progress?.phase === 'walking'
  const working =
    walking ||
    progress?.phase === 'hashing' ||
    progress?.phase === 'thumbnails' ||
    (stats != null && (stats.pendingHash > 0 || stats.pendingThumb > 0))
  const pct =
    progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : null

  const lastScan = roots.reduce<number | null>(
    (acc, r) => (r.lastScanAt && (!acc || r.lastScanAt > acc) ? r.lastScanAt : acc),
    null
  )
  const filtersActive =
    filters.formats.length > 0 ||
    filters.rootId != null ||
    filters.dateWindow !== 'any' ||
    filters.onlyDuplicates

  return (
    <div className={`app${selectedId != null ? ' with-detail' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">L</span>
          Layer Library
        </div>

        <div className="side-section">
          <span>Bibliotecas</span>
          <span>{roots.length || ''}</span>
        </div>

        <div className="roots">
          {roots.map((r) => (
            <div className="root-item" key={r.id} onDoubleClick={() => renameRoot(r)} title={r.path}>
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
              <button className="kill" title="Quitar de la biblioteca" onClick={() => removeRoot(r)}>
                ✕
              </button>
            </div>
          ))}
          {!loading && roots.length === 0 && (
            <div className="roots-empty">Aún no has añadido carpetas.</div>
          )}
        </div>

        <div className="side-add">
          <button className="btn accent" onClick={addRoot} disabled={busy}>
            + Añadir carpeta
          </button>
        </div>

        <div className="side-foot">
          <span>v{version || '0.0.0'}</span>
          <span>100% local</span>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search">
            <span>⌕</span>
            <input
              placeholder="Buscar en la biblioteca…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} title="Limpiar">
                ✕
              </button>
            )}
          </div>
          <div className="topbar-right">
            {working ? (
              <span className="pill live">
                <span className="spinner" />
                {progress?.message ?? 'Trabajando…'}
              </span>
            ) : (
              roots.length > 0 && (
                <button
                  className="btn ghost"
                  onClick={() => window.api.rescanAll()}
                  title="Volver a escanear todo"
                >
                  ↻ Reescanear
                </button>
              )
            )}
          </div>
        </div>

        {working && (
          <div className="progressbar">
            <div
              className="progressbar-fill"
              style={{ transform: `scaleX(${(pct ?? 12) / 100})` }}
            />
          </div>
        )}

        {roots.length === 0 ? (
          <div className="empty">
            <div className="empty-card">
              <div className="empty-illo">🗂️</div>
              <h1>Tu colección de impresión 3D, por fin ordenada</h1>
              <p>
                Añade las carpetas donde guardas tus STL y 3MF — disco local, unidad externa o NAS.
                Layer Library las escanea y construye una única biblioteca con miniaturas y búsqueda
                instantánea.
              </p>
              <button className="btn accent" onClick={addRoot} disabled={busy}>
                + Añadir la primera carpeta
              </button>
              <div className="hint">Nada sale de tu equipo. No se mueven ni renombran archivos.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="stat-strip">
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
              {stats != null && stats.duplicateFiles > 0 && (
                <span className="strip-dup">
                  <b>{formatCount(stats.duplicateFiles)}</b> duplicados
                  {stats.wastedBytes > 0 && ` · ${formatBytes(stats.wastedBytes)}`}
                </span>
              )}
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
              roots={roots}
              cardSize={cardSize}
              onCardSize={setCardSize}
              count={fileTotal}
            />

            {files.length === 0 ? (
              <div className="list-empty">
                {loading
                  ? 'Cargando…'
                  : query || filtersActive
                    ? 'Ningún archivo coincide con la búsqueda.'
                    : walking
                      ? 'Escaneando… los archivos aparecerán aquí.'
                      : 'No se han encontrado archivos STL ni 3MF en estas carpetas.'}
              </div>
            ) : (
              <ModelGrid
                files={files}
                size={cardSize}
                selectedId={selectedId}
                onSelect={(f) => setSelectedId((cur) => (cur === f.id ? null : f.id))}
              />
            )}
          </>
        )}
      </main>

      <DetailPanel fileId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
