import { useEffect, useRef, useState } from 'react'
import { resolveDialog, subscribeDialog, type DialogRequest } from '../lib/dialog'

export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeDialog(setReq), [])

  useEffect(() => {
    if (!req) return
    setValue(req.defaultValue ?? '')
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 60)
    return () => clearTimeout(t)
  }, [req])

  if (!req) return null

  const submit = (): void => {
    if (req.kind === 'prompt') {
      const v = value.trim()
      resolveDialog(v ? v : null)
    } else {
      resolveDialog(true)
    }
  }
  const cancel = (): void => resolveDialog(req.kind === 'prompt' ? null : false)

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel()
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={req.title}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel()
          if (e.key === 'Enter' && (req.kind === 'confirm' || value.trim())) submit()
        }}
      >
        <div className="dialog-title">{req.title}</div>
        {req.message && <p className="dialog-msg">{req.message}</p>}
        {req.kind === 'prompt' && (
          <input
            ref={inputRef}
            className="dialog-input"
            value={value}
            placeholder={req.placeholder}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <div className="dialog-actions">
          <button className="btn ghost" onClick={cancel}>
            Cancelar
          </button>
          <button
            className={`btn ${req.danger ? 'danger' : 'accent'}`}
            onClick={submit}
            disabled={req.kind === 'prompt' && !value.trim()}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
