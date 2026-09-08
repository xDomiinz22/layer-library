import { useCallback, useEffect, useState } from 'react'
import type { Collection, CollectionKind, ModelFile } from '@shared/types'
import { ModelGrid } from './ModelGrid'
import { formatCount } from '../lib/format'
import { confirmDialog, promptDialog } from '../lib/dialog'
import { toast } from '../lib/toast'
import { PlusIcon } from './icons'

export function CollectionsView({
  cardSize,
  selectedFileId,
  onSelectFile
}: {
  cardSize: number
  selectedFileId: number | null
  onSelectFile: (id: number) => void
}) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [files, setFiles] = useState<ModelFile[]>([])

  const refreshList = useCallback(async () => {
    const c = await window.api.listCollections()
    setCollections(c)
    setActiveId((cur) => cur ?? c[0]?.id ?? null)
  }, [])

  useEffect(() => {
    void refreshList()
    const off = window.api.onLibraryChanged(() => void refreshList())
    return off
  }, [refreshList])

  useEffect(() => {
    if (activeId == null) {
      setFiles([])
      return
    }
    void window.api.listCollectionFiles(activeId).then(setFiles)
  }, [activeId, collections])

  const create = async (kind: CollectionKind): Promise<void> => {
    const name = await promptDialog({
      title: kind === 'creator' ? 'Nuevo creador' : 'Nueva colección',
      placeholder: kind === 'creator' ? 'p. ej. Fotis Mint' : 'p. ej. Para regalar',
      confirmLabel: 'Crear'
    })
    if (!name) return
    const c = await window.api.createCollection(name, kind)
    await refreshList()
    setActiveId(c.id)
    toast(`${kind === 'creator' ? 'Creador' : 'Colección'} “${name}” creada`)
  }

  const rename = async (c: Collection): Promise<void> => {
    const name = await promptDialog({
      title: 'Renombrar',
      defaultValue: c.name,
      confirmLabel: 'Guardar'
    })
    if (name && name !== c.name) {
      await window.api.renameCollection(c.id, name)
      await refreshList()
    }
  }

  const remove = async (c: Collection): Promise<void> => {
    const ok = await confirmDialog({
      title: `¿Eliminar “${c.name}”?`,
      message: 'Se borra la colección, no los archivos.',
      confirmLabel: 'Eliminar',
      danger: true
    })
    if (!ok) return
    await window.api.deleteCollection(c.id)
    if (activeId === c.id) setActiveId(null)
    await refreshList()
    toast(`“${c.name}” eliminada`)
  }

  const byKind = (k: CollectionKind): Collection[] => collections.filter((c) => c.kind === k)
  const active = collections.find((c) => c.id === activeId) ?? null

  const section = (kind: CollectionKind, label: string) => (
    <div className="coll-section">
      <div className="coll-section-head">
        <span>{label}</span>
        <button className="coll-add" title={`Nueva ${label.toLowerCase()}`} onClick={() => create(kind)}>
          <PlusIcon size={13} />
        </button>
      </div>
      {byKind(kind).map((c, i) => (
        <button
          key={c.id}
          className={`coll-item${c.id === activeId ? ' on' : ''}`}
          style={{ '--i': i } as React.CSSProperties}
          onClick={() => setActiveId(c.id)}
          onDoubleClick={() => rename(c)}
        >
          <span className="coll-name">{c.name}</span>
          <span className="coll-count">{c.fileCount}</span>
        </button>
      ))}
      {byKind(kind).length === 0 && <div className="coll-empty">Ninguna todavía</div>}
    </div>
  )

  return (
    <div className="collections">
      <div className="coll-sidebar">
        {section('collection', 'Colecciones')}
        {section('creator', 'Creadores')}
      </div>

      <div className="coll-main">
        {active == null ? (
          <div className="list-empty">Crea una colección para empezar a agrupar modelos.</div>
        ) : (
          <>
            <div className="coll-main-head">
              <h2>{active.name}</h2>
              <span className="list-sub">{formatCount(active.fileCount)} modelos</span>
              <span className="strip-spacer" />
              <button className="btn ghost sm" onClick={() => rename(active)}>
                Renombrar
              </button>
              <button className="btn ghost sm" onClick={() => remove(active)}>
                Eliminar
              </button>
            </div>
            {files.length === 0 ? (
              <div className="list-empty">
                Vacía. Añade modelos desde el panel de detalle de la biblioteca.
              </div>
            ) : (
              <ModelGrid
                files={files}
                size={cardSize}
                selectedId={selectedFileId}
                detailOpen={selectedFileId != null}
                onSelect={(f) => onSelectFile(f.id)}
                onOpen={(f) => window.api.openFile(f.path)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
