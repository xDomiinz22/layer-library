import type { ModelFile } from '@shared/types'
import { formatBytes } from '../lib/format'

const FORMAT_COLOR: Record<string, string> = {
  stl: '#ff7a2f',
  '3mf': '#4aa8ff',
  obj: '#9a7aff',
  step: '#3fb950',
  gcode: '#e0b341'
}

export function FileList({ files }: { files: ModelFile[] }) {
  return (
    <div className="filelist">
      {files.map((f) => (
        <div className="filerow" key={f.id} title={f.path}>
          <span className="fmt" style={{ background: `${FORMAT_COLOR[f.format] ?? '#888'}22`, color: FORMAT_COLOR[f.format] ?? '#aaa' }}>
            {f.format}
          </span>
          <div className="fmeta">
            <div className="fname">{f.name}</div>
            <div className="fpath">{f.relPath}</div>
          </div>
          <span className={`hstate ${f.hash ? 'ok' : 'wait'}`} title={f.hash ? 'Huella calculada' : 'Pendiente de huella'}>
            {f.hash ? '●' : '○'}
          </span>
          <span className="fsize">{formatBytes(f.size)}</span>
          <button
            className="btn ghost sm"
            title="Mostrar en el explorador"
            onClick={() => window.api.revealInExplorer(f.path)}
          >
            ↗
          </button>
        </div>
      ))}
    </div>
  )
}
