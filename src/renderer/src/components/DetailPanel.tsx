import { useEffect, useState } from 'react'
import type { FileDetail } from '@shared/types'
import { thumbUrl } from './ModelGrid'
import { formatBytes, formatDims, formatTris, fullDate } from '../lib/format'

export function DetailPanel({ fileId, onClose }: { fileId: number | null; onClose: () => void }) {
  const [detail, setDetail] = useState<FileDetail | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (fileId == null) return
    let live = true
    setDetail(null)
    setCopied(false)
    window.api.getFileDetail(fileId).then((d) => {
      if (live) setDetail(d)
    })
    return () => {
      live = false
    }
  }, [fileId])

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
                {f.thumbStatus === 'pending' ? 'Generando miniatura…' : 'Sin miniatura'}
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
            <button className="btn ghost" onClick={copyPath}>
              {copied ? '¡Copiado!' : 'Copiar ruta'}
            </button>
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
        </div>
      )}
    </aside>
  )
}
