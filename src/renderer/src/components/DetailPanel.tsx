import { useCallback, useEffect, useRef, useState } from 'react'
import type { Collection, FileDetail } from '@shared/types'
import { thumbUrl } from './ModelGrid'
import {
  formatBytes,
  formatDims,
  formatDuration,
  formatGrams,
  formatTris,
  fullDate
} from '../lib/format'
import { toast } from '../lib/toast'
import {
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  CopyIcon,
  FolderOpenIcon,
  OpenIcon,
  PlusIcon,
  TrashIcon
} from './icons'

export function DetailPanel({
  fileId,
  onClose,
  onTrashed
}: {
  fileId: number | null
  onClose: () => void
  onTrashed: () => void
}) {
  // Mantiene el contenido montado durante la animación de salida.
  const [shownId, setShownId] = useState<number | null>(fileId)
  const [detail, setDetail] = useState<FileDetail | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [copied, setCopied] = useState(false)
  const [showColl, setShowColl] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (fileId != null) {
      clearTimeout(closeTimer.current)
      setShownId(fileId)
      setDetail(null)
      setCopied(false)
      setShowColl(false)
    } else if (shownId != null) {
      closeTimer.current = setTimeout(() => setShownId(null), 320)
    }
    return () => clearTimeout(closeTimer.current)
  }, [fileId, shownId])

  const load = useCallback(async () => {
    if (shownId == null) return
    const [d, c] = await Promise.all([
      window.api.getFileDetail(shownId),
      window.api.listCollections()
    ])
    setDetail(d)
    setCollections(c)
  }, [shownId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && fileId != null) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, fileId])

  const open = fileId != null
  const f = detail?.file

  const copyPath = (): void => {
    if (!f) return
    window.api.copyText(f.path)
    setCopied(true)
    toast('Ruta copiada al portapapeles')
    setTimeout(() => setCopied(false), 1400)
  }
  const toggleQueue = async (): Promise<void> => {
    if (!f) return
    const nowIn = await window.api.toggleQueue(f.id)
    toast(nowIn ? `“${f.name}” añadido a la cola` : `“${f.name}” quitado de la cola`)
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
      toast(`“${f.name}” movido a la papelera`, 'danger')
      onClose()
      onTrashed()
    }
  }

  return (
    <aside className={`detail${open ? ' open' : ''}`} aria-hidden={!open}>
      {shownId != null && (
        <>
          <div className="detail-head">
            <span className="detail-title">{f?.name ?? 'Detalle'}</span>
            <button className="btn ghost sm icon-btn" onClick={onClose} title="Cerrar (Esc)">
              <CloseIcon size={15} />
            </button>
          </div>

          {!detail ? (
            <div className="detail-body">
              <div className="detail-preview sk-shimmer" />
              <div className="kv-skeleton">
                {Array.from({ length: 6 }, (_, i) => (
                  <div className="sk-line" key={i} />
                ))}
              </div>
            </div>
          ) : !f ? (
            <div className="detail-body">
              <p className="dialog-msg">Este archivo ya no está disponible.</p>
            </div>
          ) : (
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
                {f.printSeconds != null && (
                  <>
                    <dt>Impresión</dt>
                    <dd>
                      {formatDuration(f.printSeconds)}
                      {f.plateCount && f.plateCount > 1 && (
                        <span className="kv-note"> · {f.plateCount} platos</span>
                      )}
                    </dd>
                  </>
                )}
                {f.filamentG != null && (
                  <>
                    <dt>Filamento</dt>
                    <dd>
                      {formatGrams(f.filamentG)}
                      {f.filamentTypes.length > 0 && (
                        <span className="kv-note"> · {f.filamentTypes.join(', ')}</span>
                      )}
                    </dd>
                  </>
                )}
                {f.filamentColors.length > 0 && (
                  <>
                    <dt>Colores</dt>
                    <dd className="kv-colors">
                      {f.filamentColors.map((c) => (
                        <span key={c} className="swatch" style={{ background: c }} title={c} />
                      ))}
                    </dd>
                  </>
                )}
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
                  <OpenIcon size={14} plain />
                  Abrir
                </button>
                <button className="btn" onClick={() => window.api.revealInExplorer(f.path)}>
                  <FolderOpenIcon size={14} plain />
                  Ver en carpeta
                </button>
                <button className={`btn${detail.inQueue ? ' accent' : ''}`} onClick={toggleQueue}>
                  {detail.inQueue ? <CheckIcon size={14} plain /> : <PlusIcon size={14} plain />}
                  {detail.inQueue ? 'En cola' : 'Cola'}
                </button>
                <button className="btn ghost" onClick={copyPath}>
                  <CopyIcon size={14} plain />
                  {copied ? '¡Copiado!' : 'Copiar ruta'}
                </button>
              </div>

              <div className="detail-coll">
                <button className="coll-toggle" onClick={() => setShowColl((s) => !s)}>
                  <ChevronIcon open={showColl} size={13} />
                  Colecciones
                  {detail.collectionIds.length > 0 && (
                    <span className="coll-badge">{detail.collectionIds.length}</span>
                  )}
                </button>
                <div className={`coll-checks${showColl ? ' open' : ''}`}>
                  <div className="coll-checks-inner">
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
                          <span className="coll-kind">
                            {c.kind === 'creator' ? 'creador' : ''}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
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
                <TrashIcon size={14} plain />
                Mover a la papelera
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
