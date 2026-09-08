import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ModelFile } from '@shared/types'
import { formatDuration, formatGrams } from '../lib/format'
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
const PAD = 18 // .grid-scroll padding
const DETAIL_W = 360 // --detail-w
const DETAIL_MIN_VW = 1180 // el hueco solo se reserva en ventanas anchas (media query)

/** Ancho de contenido "real" del scroller: su clientWidth no cambia aunque el
 *  padding-right se anime, así que la rejilla no se comprime durante la
 *  transición del panel. Solo se recalcula al abrir/cerrar el panel o al
 *  redimensionar la ventana, nunca fotograma a fotograma. */
function useShellWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = (): void => setW(el.clientWidth)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    window.addEventListener('resize', read)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', read)
    }
  }, [ref])
  return w
}

export function ModelGrid({
  files,
  size,
  selectedId,
  detailOpen,
  onSelect,
  onOpen
}: {
  files: ModelFile[]
  size: number
  selectedId: number | null
  detailOpen: boolean
  onSelect: (f: ModelFile) => void
  onOpen: (f: ModelFile) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const shellW = useShellWidth(scrollRef)

  useEffect(() => () => clearTimeout(clickTimer.current), [])

  const wide = typeof window !== 'undefined' && window.innerWidth >= DETAIL_MIN_VW

  // Al ABRIR se espera a que el panel termine de entrar antes de encoger la
  // rejilla, así el reajuste de columnas (6→4) queda oculto tras el panel ya
  // colocado y las tarjetas visibles nunca se comprimen. Al CERRAR se recupera
  // el ancho al instante: las columnas reaparecen conforme el panel se retira.
  const [reserved, setReserved] = useState(false)
  useEffect(() => {
    if (detailOpen && wide) {
      const t = setTimeout(() => setReserved(true), 460)
      return () => clearTimeout(t)
    }
    setReserved(false)
    return undefined
  }, [detailOpen, wide])

  const reserve = reserved ? DETAIL_W + 16 : 0
  const avail = Math.max((shellW || size + PAD * 2) - PAD * 2 - reserve, size)
  const cols = Math.max(1, Math.floor((avail + GAP) / (size + GAP)))
  const thumbH = Math.max((avail - (cols - 1) * GAP) / cols, size * 0.6)
  const rowH = Math.round(thumbH + CARD_GAP + NAME_LINE + ROW_PAD_B)
  const rowCount = Math.ceil(files.length / cols)

  const handleClick = (f: ModelFile): void => {
    clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => onSelect(f), 220)
  }
  const handleDouble = (f: ModelFile): void => {
    clearTimeout(clickTimer.current)
    onOpen(f)
  }

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
      <div
        className="grid-inner"
        style={{ height: virt.getTotalSize(), width: avail || undefined }}
      >
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
                  className={`card${f.id === selectedId ? ' on' : ''}`}
                  key={f.id}
                  title={f.path}
                  onClick={() => handleClick(f)}
                  onDoubleClick={() => handleDouble(f)}
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
                    {(f.printSeconds != null || f.filamentG != null) && (
                      <span className="card-time">
                        {[
                          f.printSeconds != null ? formatDuration(f.printSeconds) : null,
                          f.filamentG != null ? formatGrams(f.filamentG) : null
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
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
