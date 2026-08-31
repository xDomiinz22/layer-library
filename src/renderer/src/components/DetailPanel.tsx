import { useCallback, useEffect, useState } from 'react'
import type { Collection, FileDetail } from '@shared/types'
import { thumbUrl } from './ModelGrid'
import { formatBytes, formatDims, formatTris, fullDate } from '../lib/format'

export function DetailPanel({
  fileId,
  onClose,
  onTrashed
}: {
  fileId: number | null
  onClose: () => void
  onTrashed: () => void
}) {
  const [detail, setDetail] = useState<FileDetail | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [copied, setCopied] = useState(false)
  const [showColl, setShowColl] = useState(false)

  const load = useCallback(async () => {
    if (fileId == null) return
    const [d, c] = await Promise.all([
      window.api.getFileDetail(fileId),
      window.api.listCollections()
    ])
    setDetail(d)
    setCollections(c)
  }, [fileId])

  useEffect(() => {
    setDetail(null)
    setCopied(false)
    setShowColl(false)
    void load()
  }, [fileId, load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (fileId == null) return null

  const f = detail?.file
  const copyPath = (): void => {
    if (!f) return
    window.api.copyText(f.path)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  const toggleQueue = async (): Promise<void> => {
    if (!f) return
    await window.api.toggleQueue(f.id)
    await load()
  }
  const toggleColl = async (cid: number, member: boolean): Promise<void> => {
    if (!f) return
    await window.api.setFileCollection(f.id, cid, member)
    await load()
  }
  const trash = async (): Promise<void> => {
    if (!f) return
    const n = await window.api.trashFiles([f.id])
    if (n > 0) {
      onClose()
      onTrashed()
    }
  }

  return (
    <aside className="detail">
      <div className="detail-head">
        <span className="detail-title">{f?.name ?? 'Cargando…'}</span>
        <button className="btn ghost sm" onClick={onClose} title="Cerrar (Esc)">
          ✕
        </button>
      </div>

      {f && detail && (
        <div className="detail-body">
          <div className="detail-preview">
            {thumbUrl(f) ? (
              <img src={thumbUrl(f)!} alt={f.name} />
            ) : (
              <div className="detail-preview-ph">
                {f.thumbStatus === 'pending'
                  ? 'Generando miniatura…'
                  : f.format === 'step'
                    ? 'STEP · vista previa no disponible'
                    : f.format === 'gcode'
                      ? 'G-code sin miniatura embebida'
                      : 'Sin miniatura'}
              </div>
            )}
          </div>

          <dl className="kv">
            <dt>Formato</dt>
            <dd>{f.format.toUpperCase()}</dd>
            <dt>Tamaño</dt>
            <dd>{formatBytes(f.size)}</dd>
            <dt>Dimensiones</dt>
            <dd>{formatDims(f.dim)}</dd>
            <dt>Malla</dt>
            <dd>{formatTris(f.triCount)}</dd>
            <dt>Modificado</dt>
            <dd>{fullDate(f.mtimeMs)}</dd>
            <dt>Biblioteca</dt>
            <dd>{detail.rootLabel}</dd>
            <dt>Ruta</dt>
            <dd className="kv-path">{f.relPath}</dd>
            <dt>Huella</dt>
            <dd className="kv-hash">{f.hash ? f.hash.slice(0, 24) + '…' : 'pendiente'}</dd>
          </dl>

          <div className="detail-actions">
            <button className="btn" onClick={() => window.api.openFile(f.path)}>
              Abrir
            </button>
            <button className="btn" onClick={() => window.api.revealInExplorer(f.path)}>
              Ver en carpeta
            </button>
            <button className={`btn${detail.inQueue ? ' accent' : ''}`} onClick={toggleQueue}>
              {detail.inQueue ? '✓ En cola' : '+ Cola'}
            </button>
            <button className="btn ghost" onClick={copyPath}>
              {copied ? '¡Copiado!' : 'Copiar ruta'}
            </button>
          </div>

          <div className="detail-coll">
            <button className="coll-toggle" onClick={() => setShowColl((s) => !s)}>
              Colecciones {showColl ? '▲' : '▼'}
              {detail.collectionIds.length > 0 && (
                <span className="coll-badge">{detail.collectionIds.length}</span>
              )}
            </button>
            {showColl && (
              <div className="coll-checks">
                {collections.length === 0 && (
                  <div className="coll-empty">Aún no has creado ninguna.</div>
                )}
                {collections.map((c) => {
                  const on = detail.collectionIds.includes(c.id)
                  return (
                    <label key={c.id} className="coll-check">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleColl(c.id, !on)}
                      />
                      {c.name}
                      <span className="coll-kind">{c.kind === 'creator' ? 'creador' : ''}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {detail.duplicates.length > 0 && (
            <div className="detail-dups">
              <h4>{detail.duplicates.length} copia(s) idéntica(s)</h4>
              {detail.duplicates.map((d) => (
                <button
                  key={d.id}
                  className="dup-row"
                  title={d.path}
                  onClick={() => window.api.revealInExplorer(d.path)}
                >
                  <span className="dup-lib">{d.rootLabel}</span>
                  <span className="dup-path">{d.relPath}</span>
                </button>
              ))}
            </div>
          )}

          <button className="btn danger" onClick={trash}>
            Mover a la papelera
          </button>
        </div>
      )}
    </aside>
  )
}
