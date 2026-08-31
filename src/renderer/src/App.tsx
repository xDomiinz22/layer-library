import { useCallback, useEffect, useState } from 'react'
import type { LibraryRoot } from '@shared/types'

const KIND_LABEL: Record<LibraryRoot['kind'], string> = {
  local: 'Local',
  external: 'Unidad externa',
  network: 'Red / NAS'
}

export function App() {
  const [roots, setRoots] = useState<LibraryRoot[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setRoots(await window.api.listRoots())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    window.api.appVersion().then(setVersion)
  }, [refresh])

  const addRoot = useCallback(async () => {
    setBusy(true)
    try {
      const added = await window.api.addRoot()
      if (added) await refresh()
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const removeRoot = useCallback(
    async (r: LibraryRoot) => {
      await window.api.removeRoot(r.id)
      await refresh()
    },
    [refresh]
  )

  const renameRoot = useCallback(
    async (r: LibraryRoot) => {
      const next = window.prompt('Nombre de la biblioteca', r.label)
      if (next && next.trim() && next !== r.label) {
        await window.api.renameRoot(r.id, next.trim())
        await refresh()
      }
    },
    [refresh]
  )

  const totalFiles = roots.reduce((s, r) => s + r.fileCount, 0)
  const onlineCount = roots.filter((r) => r.online).length

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
              <span className={`dot${r.online ? '' : ' offline'}`} />
              <span className="meta">
                <div className="name">{r.label}</div>
                <div className="sub">
                  {r.online ? `${r.fileCount.toLocaleString('es')} archivos` : 'Sin conexión'}
                </div>
              </span>
              <button
                className="kill"
                title="Quitar de la biblioteca"
                onClick={() => removeRoot(r)}
              >
                ✕
              </button>
            </div>
          ))}
          {!loading && roots.length === 0 && (
            <div style={{ padding: '10px', color: 'var(--text-faint)', fontSize: 12.5 }}>
              Aún no has añadido carpetas.
            </div>
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
              placeholder="Buscar en tu biblioteca…  (Fase 3)"
              disabled
            />
          </div>
        </div>

        <div className="content">
          {roots.length === 0 ? (
            <div className="empty">
              <div className="empty-card">
                <div className="empty-illo">🗂️</div>
                <h1>Tu colección de impresión 3D, por fin ordenada</h1>
                <p>
                  Añade las carpetas donde guardas tus STL y 3MF — disco local, unidad
                  externa o NAS. Layer Library las escanea y construye una única
                  biblioteca con miniaturas y búsqueda instantánea.
                </p>
                <button className="btn accent" onClick={addRoot} disabled={busy}>
                  + Añadir la primera carpeta
                </button>
                <div className="hint">Nada sale de tu equipo. No se mueven ni renombran archivos.</div>
              </div>
            </div>
          ) : (
            <div className="overview">
              <div className="stat-row">
                <div className="stat">
                  <div className="n">{roots.length}</div>
                  <div className="l">bibliotecas ({onlineCount} en línea)</div>
                </div>
                <div className="stat">
                  <div className="n">{totalFiles.toLocaleString('es')}</div>
                  <div className="l">archivos indexados</div>
                </div>
              </div>

              <h2>Carpetas de la biblioteca</h2>
              {roots.map((r) => (
                <div className="root-card" key={r.id}>
                  <span className={`dot${r.online ? '' : ' offline'}`} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.label}</div>
                    <div className="path">{r.path}</div>
                  </div>
                  <span className={`badge${r.online ? '' : ' off'}`}>
                    {r.online ? KIND_LABEL[r.kind] : 'Desconectada'}
                  </span>
                </div>
              ))}

              <div className="phase-note">
                <strong>Fase 0 completada.</strong> El escaneo de archivos y el recuento
                real llegan en la Fase 1; las miniaturas en la Fase 2.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
