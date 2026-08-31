import { useCallback, useEffect, useState } from 'react'
import type { Printer, QueueItem } from '@shared/types'
import { thumbUrl } from './ModelGrid'
import { formatBytes } from '../lib/format'

function QRow({
  it,
  printers,
  refresh,
  onSelect
}: {
  it: QueueItem
  printers: Printer[]
  refresh: () => Promise<void>
  onSelect: (id: number) => void
}) {
  const url = thumbUrl(it.file)
  return (
    <div className={`q-row${it.printed ? ' done' : ''}`}>
      <div className="q-thumb" onClick={() => onSelect(it.file.id)}>
        {url ? <img src={url} alt="" /> : <span className="ph-glyph sm">△</span>}
      </div>
      <div className="q-info" onClick={() => onSelect(it.file.id)}>
        <div className="q-name">{it.file.name}</div>
        <div className="q-sub">{formatBytes(it.file.size)}</div>
      </div>
      {!it.printed && (
        <div className="q-order">
          <button onClick={() => window.api.moveQueueItem(it.id, 'up').then(refresh)}>↑</button>
          <button onClick={() => window.api.moveQueueItem(it.id, 'down').then(refresh)}>↓</button>
        </div>
      )}
      <select
        className="sel"
        value={it.printerId ?? ''}
        onChange={(e) =>
          window.api
            .updateQueueItem(it.id, { printerId: e.target.value ? Number(e.target.value) : null })
            .then(refresh)
        }
      >
        <option value="">Sin asignar</option>
        {printers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        className="btn sm ghost"
        title={it.printed ? 'Marcar como pendiente' : 'Marcar como impreso'}
        onClick={() => window.api.updateQueueItem(it.id, { printed: !it.printed }).then(refresh)}
      >
        {it.printed ? '↩' : '✓'}
      </button>
      <button
        className="btn sm ghost"
        title="Quitar de la cola"
        onClick={() => window.api.removeFromQueue(it.id).then(refresh)}
      >
        ✕
      </button>
    </div>
  )
}

export function QueueView({ onSelect }: { onSelect: (id: number) => void }) {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [items, setItems] = useState<QueueItem[]>([])
  const [newPrinter, setNewPrinter] = useState('')

  const refresh = useCallback(async () => {
    const [p, q] = await Promise.all([window.api.listPrinters(), window.api.listQueue()])
    setPrinters(p)
    setItems(q)
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.api.onLibraryChanged(() => void refresh())
    return off
  }, [refresh])

  const addPrinter = async (): Promise<void> => {
    if (!newPrinter.trim()) return
    await window.api.createPrinter(newPrinter.trim())
    setNewPrinter('')
    await refresh()
  }

  const pending = items.filter((i) => !i.printed)
  const printed = items.filter((i) => i.printed)

  const columns: { key: string; name: string; printerId: number | null }[] = [
    ...printers.map((p) => ({ key: `p${p.id}`, name: p.name, printerId: p.id as number | null })),
    { key: 'none', name: 'Sin asignar', printerId: null }
  ]

  return (
    <div className="queue">
      <div className="queue-head">
        <b>{pending.length}</b> en cola
        {printed.length > 0 && <span className="q-muted"> · {printed.length} impresos</span>}
        <span className="strip-spacer" />
        <input
          className="sel q-newprinter"
          placeholder="Nueva impresora…"
          value={newPrinter}
          onChange={(e) => setNewPrinter(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPrinter()}
        />
        <button className="btn sm" onClick={addPrinter}>
          + Impresora
        </button>
      </div>

      {items.length === 0 ? (
        <div className="list-empty">
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🖨️</div>
            La cola está vacía. Añade modelos desde el panel de detalle de la biblioteca.
          </div>
        </div>
      ) : (
        <div className="queue-body">
          {columns.map((col) => {
            const colItems = pending.filter((i) => i.printerId === col.printerId)
            // Oculta "Sin asignar" solo si está vacío y ya hay impresoras con cola.
            if (colItems.length === 0 && col.printerId === null && printers.length > 0) return null
            return (
              <div className="q-col" key={col.key}>
                <div className="q-col-head">
                  {col.name}
                  <span className="q-count">{colItems.length}</span>
                  {col.printerId != null && (
                    <button
                      className="q-del-printer"
                      title="Eliminar impresora"
                      onClick={() => window.api.deletePrinter(col.printerId as number).then(refresh)}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {colItems.map((it) => (
                  <QRow key={it.id} it={it} printers={printers} refresh={refresh} onSelect={onSelect} />
                ))}
                {colItems.length === 0 && <div className="q-col-empty">—</div>}
              </div>
            )
          })}

          {printed.length > 0 && (
            <div className="q-col q-printed">
              <div className="q-col-head">Impresos</div>
              {printed.map((it) => (
                <QRow key={it.id} it={it} printers={printers} refresh={refresh} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
