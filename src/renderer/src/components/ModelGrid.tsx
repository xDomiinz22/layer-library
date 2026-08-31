import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useResizeObserver } from '../lib/useResizeObserver'
import type { ModelFile } from '@shared/types'
import { formatBytes } from '../lib/format'

const FORMAT_COLOR: Record<string, string> = {
  stl: '#ff7a2f',
  '3mf': '#4aa8ff',
  obj: '#9a7aff',
  step: '#3fb950',
  gcode: '#e0b341'
}

const GLYPH: Record<string, string> = {
  stl: '△',
  obj: '△',
  '3mf': '◫',
  step: '⬡',
  gcode: '⌰'
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
      <span className="ph-glyph">{GLYPH[f.format] ?? '△'}</span>
    </div>
  )
}

const GAP = 14
const NAME_H = 40 // nombre + meta

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
  const width = useResizeObserver(scrollRef)

  const cols = Math.max(1, Math.floor((width + GAP) / (size + GAP)))
  const rowH = size + NAME_H + GAP
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
      <div className="grid-inner" style={{ height: virt.getTotalSize() }}>
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
                      style={{ background: FORMAT_COLOR[f.format] ?? '#888', color: '#0e1013' }}
                    >
                      {f.format}
                    </span>
                  </div>
                  <div className="card-name">{f.name}</div>
                  <div className="card-meta">{formatBytes(f.size)}</div>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
