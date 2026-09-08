import { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/types'
import { DownloadIcon, RefreshIcon } from './icons'

/**
 * Pie de la barra lateral. En reposo muestra la versión; si hay una
 * actualización descargándose muestra el progreso, y si ya está lista un
 * botón para reiniciar e instalarla. La descarga es automática (contra las
 * Releases de GitHub); el usuario solo elige cuándo reiniciar.
 */
export function UpdateFoot({ version }: { version: string }) {
  const [st, setSt] = useState<UpdateState>({ phase: 'idle' })

  useEffect(() => {
    void window.api.getUpdateState().then(setSt)
    return window.api.onUpdateState(setSt)
  }, [])

  if (st.phase === 'downloading') {
    return (
      <div className="side-foot upd">
        <span className="upd-spin">
          <DownloadIcon size={12} plain />
        </span>
        Descargando v{st.version}… {st.percent ?? 0}%
      </div>
    )
  }

  if (st.phase === 'ready') {
    return (
      <div className="side-foot upd">
        <button className="upd-btn" onClick={() => void window.api.installUpdate()}>
          <RefreshIcon size={13} plain />
          Reiniciar para actualizar a v{st.version}
        </button>
      </div>
    )
  }

  return (
    <div className="side-foot">
      <span>v{version || '0.0.0'}</span>
      <span>100% local</span>
    </div>
  )
}
