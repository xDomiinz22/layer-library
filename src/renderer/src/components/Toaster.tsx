import { useEffect, useState } from 'react'
import { dismissToast, subscribeToasts, type Toast } from '../lib/toast'

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => subscribeToasts(setToasts), [])

  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`toast ${t.tone}`}
          onClick={() => dismissToast(t.id)}
          title="Descartar"
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}
