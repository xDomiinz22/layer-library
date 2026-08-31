import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useResizeObserver } from '../lib/useResizeObserver'
import type { ModelFile } from '@shared/types'
import { formatDuration } from '../lib/format'
import { FormatGlyph } from './icons'

const FORMAT_COLOR: Record<string, string> = {
  stl: 'var(--fmt-stl)',
  '3mf': 'var(--fmt-3mf)',
  obj: 'var(--fmt-obj)',
  step: 'var(--fmt-step)',
  gcode: 'var(--fmt-gcode)'
}

export function thumbUrl(f: ModelFile): string | null {
  if (f.thumbStatus !== 'ready' || !f.thumbFile) return null
  if (f.thumbFile.startsWith('data:')) return f.thumbFile
  return `thumb://img/${f.thumbFile}`
}

function Thumb({ f }: { f: ModelFile }) {
  const url = thumbUrl(f)
  if (url) return <img className="card-img" src={url} alt={f.name} loading="lazy" />
  if (f.thumbStatus === 'pending')
    return (
      <div className="card-img placeholder">
        <span className="shimmer" />
      </div>
    )
  return (
    <div className="card-img placeholder">
      <span className="ph-glyph">
        <FormatGlyph format={f.format} size={38} />
      </span>
    </div>
  )
}

const GAP = 16
const CARD_GAP = 9 // hueco miniatura → nombre
const NAME_LINE = 19 // altura de la línea del nombre
const ROW_PAD_B = 18 // .grid-row padding-bottom

export function ModelGrid({
  files,
  size,
  selectedId,
  onSelect
}: {
  files: ModelFile[]
  size: number
  selectedId: number | null
  onSelect: (f: ModelFile) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  // `innerRef` mide el ancho de contenido real (descuenta padding y el hueco
  // reservado para el panel de detalle).
  const inner = useResizeObserver(innerRef)

  // Si el ancho medido es implausiblemente pequeño (p. ej. mientras el panel de
  // detalle reajusta el layout) se usa `size` para no colapsar la rejilla.
  const w = inner > 60 ? inner : size
  const cols = Math.max(1, Math.floor((w + GAP) / (size + GAP)))
  // Altura real de fila = miniatura cuadrada (según ancho de columna) + nombre + hueco.
  const thumbH = Math.max((w - (cols - 1) * GAP) / cols, size * 0.6)
  const rowH = Math.round(thumbH + CARD_GAP + NAME_LINE + ROW_PAD_B)
  const rowCount = Math.ceil(files.length / cols)

  const virt = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 4
  })

  // Recalcula al cambiar columnas/tamaño.
  useEffect(() => {
    virt.measure()
  }, [cols, rowH, virt])

  return (
    <div className="grid-scroll" ref={scrollRef}>
      <div className="grid-inner" ref={innerRef} style={{ height: virt.getTotalSize() }}>
        {virt.getVirtualItems().map((vr) => {
          const start = vr.index * cols
          const rowFiles = files.slice(start, start + cols)
          return (
            <div
              key={vr.key}
              className="grid-row"
              style={{
                transform: `translateY(${vr.start}px)`,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
              }}
            >
              {rowFiles.map((f) => (
                <button
                  className={`card${f.id === selectedId ? ' sel' : ''}`}
                  key={f.id}
                  title={f.path}
                  onClick={() => onSelect(f)}
                  onDoubleClick={() => window.api.revealInExplorer(f.path)}
                >
                  <div className="card-thumb">
                    <Thumb f={f} />
                    <span
                      className="card-fmt"
                      style={{ '--fmt': FORMAT_COLOR[f.format] ?? 'var(--text-faint)' } as React.CSSProperties}
                    >
                      {f.format}
                    </span>
                    {f.filamentColors.length > 0 && (
                      <span className="card-colors">
                        {f.filamentColors.slice(0, 4).map((c, i) => (
                          <span key={i} className="card-dot" style={{ background: c }} />
                        ))}
                      </span>
                    )}
                    {f.printSeconds != null && (
                      <span className="card-time">{formatDuration(f.printSeconds)}</span>
                    )}
                  </div>
                  <div className="card-name">{f.name}</div>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
