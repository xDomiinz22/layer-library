import type { ModelFile } from '@shared/types'
import { formatBytes } from '../lib/format'

const FORMAT_COLOR: Record<string, string> = {
  stl: '#ff7a2f',
  '3mf': '#4aa8ff',
  obj: '#9a7aff',
  step: '#3fb950',
  gcode: '#e0b341'
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
      <span className="ph-glyph">{f.format === '3mf' ? '◫' : '△'}</span>
    </div>
  )
}

export function ModelGrid({
  files,
  size,
  onOpen
}: {
  files: ModelFile[]
  size: number
  onOpen: (f: ModelFile) => void
}) {
  return (
    <div className="grid" style={{ '--card': `${size}px` } as React.CSSProperties}>
      {files.map((f) => (
        <button
          className="card"
          key={f.id}
          title={f.path}
          onDoubleClick={() => window.api.revealInExplorer(f.path)}
          onClick={() => onOpen(f)}
        >
          <div className="card-thumb">
            <Thumb f={f} />
            <span
              className="card-fmt"
              style={{
                background: `${FORMAT_COLOR[f.format] ?? '#888'}`,
                color: '#0e1013'
              }}
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
}
