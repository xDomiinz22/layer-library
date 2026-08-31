import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryRoot, LibraryStats, ModelFile, ScanProgress } from '@shared/types'
import { ModelGrid } from './components/ModelGrid'
import { formatBytes, formatCount, relativeTime } from './lib/format'

const CARD_SIZES = [132, 168, 216]

export function App() {
  const [roots, setRoots] = useState<LibraryRoot[]>([])
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [files, setFiles] = useState<ModelFile[]>([])
  const [fileTotal, setFileTotal] = useState(0)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState('')
  const [busy, setBusy] = useState(false)
  const [cardSize, setCardSize] = useState(() => {
    const v = Number(localStorage.getItem('cardSize'))
    return CARD_SIZES.includes(v) ? v : CARD_SIZES[1]
  })

  const queryRef = useRef(query)
  queryRef.current = query

  const refreshRoots = useCallback(async () => {
    setRoots(await window.api.listRoots())
  }, [])

  const refreshFiles = useCallback(async () => {
    const res = await window.api.listFiles({ query: queryRef.current, sort: 'recent', limit: 300 })
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
      if (p.phase === 'done') {
        void refreshRoots()
        void window.api.getStats().then(setStats)
      }
      if (p.phase === 'walking' && p.total > 0) void refreshRoots()
    })
    return () => {
      offChanged()
      offProgress()
      if (t) clearTimeout(t)
    }
  }, [refreshAll, refreshRoots, refreshFiles])

  // Búsqueda con debounce.
  useEffect(() => {
    const t = setTimeout(() => void refreshFiles(), 200)
    return () => clearTimeout(t)
  }, [query, refreshFiles])

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

  const rescan = useCallback(async () => {
    await window.api.rescanAll()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('cardSize', String(cardSize))
    } catch {
      /* modo restringido */
    }
  }, [cardSize])

  const onlineCount = roots.filter((r) => r.online).length
  const walking = roots.some((r) => r.scanState === 'walking') || progress?.phase === 'walking'
  const working =
    walking ||
    progress?.phase === 'hashing' ||
    progress?.phase === 'thumbnails' ||
    (stats != null && (stats.pendingHash > 0 || stats.pendingThumb > 0))

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : null

  return (
    <div className="app">
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
            <div
              className="root-item"
              key={r.id}
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
              placeholder="Filtrar por nombre o carpeta…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="topbar-right">
            {working ? (
              <span className="pill live">
                <span className="spinner" />
                {progress?.message ?? 'Trabajando…'}
              </span>
            ) : (
              roots.length > 0 && (
                <button className="btn ghost" onClick={rescan} title="Volver a escanear todo">
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

        <div className="content">
          {roots.length === 0 ? (
            <div className="empty">
              <div className="empty-card">
                <div className="empty-illo">🗂️</div>
                <h1>Tu colección de impresión 3D, por fin ordenada</h1>
                <p>
                  Añade las carpetas donde guardas tus STL y 3MF — disco local, unidad externa o
                  NAS. Layer Library las escanea y construye una única biblioteca con miniaturas y
                  búsqueda instantánea.
                </p>
                <button className="btn accent" onClick={addRoot} disabled={busy}>
                  + Añadir la primera carpeta
                </button>
                <div className="hint">
                  Nada sale de tu equipo. No se mueven ni renombran archivos.
                </div>
              </div>
            </div>
          ) : (
            <div className="overview">
              <div className="stat-row">
                <div className="stat">
                  <div className="n">{formatCount(stats?.totalFiles ?? 0)}</div>
                  <div className="l">archivos</div>
                </div>
                <div className="stat">
                  <div className="n">{formatBytes(stats?.totalSize ?? 0)}</div>
                  <div className="l">en disco</div>
                </div>
                {(stats?.byFormat ?? []).map((f) => (
                  <div className="stat" key={f.format}>
                    <div className="n">{formatCount(f.count)}</div>
                    <div className="l">{f.format.toUpperCase()}</div>
                  </div>
                ))}
                <div className="stat">
                  <div className="n">
                    {formatCount(stats?.duplicateFiles ?? 0)}
                    {stats && stats.wastedBytes > 0 && (
                      <span className="n-sub"> · {formatBytes(stats.wastedBytes)}</span>
                    )}
                  </div>
                  <div className="l">duplicados</div>
                </div>
                {stats != null && (stats.pendingHash > 0 || stats.pendingThumb > 0) && (
                  <div className="stat muted">
                    <div className="n">
                      {formatCount(Math.max(stats.pendingHash, stats.pendingThumb))}
                    </div>
                    <div className="l">
                      {stats.pendingThumb > 0 ? 'sin miniatura' : 'sin huella'}
                    </div>
                  </div>
                )}
              </div>

              <div className="list-head">
                <h2>
                  {query
                    ? `${formatCount(fileTotal)} resultado${fileTotal === 1 ? '' : 's'}`
                    : 'Archivos recientes'}
                </h2>
                <div className="list-tools">
                  <span className="list-sub">
                    {onlineCount}/{roots.length} en línea · escaneo{' '}
                    {relativeTime(
                      roots.reduce<number | null>(
                        (acc, r) =>
                          r.lastScanAt && (!acc || r.lastScanAt > acc) ? r.lastScanAt : acc,
                        null
                      )
                    )}
                  </span>
                  <div className="size-toggle">
                    {CARD_SIZES.map((s, i) => (
                      <button
                        key={s}
                        className={s === cardSize ? 'on' : ''}
                        onClick={() => setCardSize(s)}
                        title={['Pequeño', 'Mediano', 'Grande'][i]}
                      >
                        {['S', 'M', 'L'][i]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {files.length === 0 ? (
                <div className="list-empty">
                  {loading
                    ? 'Cargando…'
                    : query
                      ? 'Ningún archivo coincide con el filtro.'
                      : walking
                        ? 'Escaneando… los archivos aparecerán aquí.'
                        : 'No se han encontrado archivos STL ni 3MF en estas carpetas.'}
                </div>
              ) : (
                <>
                  <ModelGrid
                    files={files}
                    size={cardSize}
                    onOpen={(f) => window.api.revealInExplorer(f.path)}
                  />
                  {fileTotal > files.length && (
                    <div className="list-more">
                      Mostrando {formatCount(files.length)} de {formatCount(fileTotal)}. El
                      explorador completo llega en la Fase 3.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
