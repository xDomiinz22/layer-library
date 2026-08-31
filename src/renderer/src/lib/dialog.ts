/** Diálogos modales promesa-based, renderizados por <DialogHost>. */

export interface DialogRequest {
  id: number
  kind: 'prompt' | 'confirm'
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel: string
  danger?: boolean
  resolve: (value: string | boolean | null) => void
}

let seq = 0
let current: DialogRequest | null = null
const listeners = new Set<(d: DialogRequest | null) => void>()

function emit(): void {
  for (const l of listeners) l(current)
}

export function subscribeDialog(cb: (d: DialogRequest | null) => void): () => void {
  listeners.add(cb)
  cb(current)
  return () => listeners.delete(cb)
}

export function resolveDialog(value: string | boolean | null): void {
  if (!current) return
  const r = current
  current = null
  emit()
  r.resolve(value)
}

export function promptDialog(opts: {
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
}): Promise<string | null> {
  return new Promise((resolve) => {
    current = {
      id: ++seq,
      kind: 'prompt',
      title: opts.title,
      message: opts.message,
      defaultValue: opts.defaultValue ?? '',
      placeholder: opts.placeholder,
      confirmLabel: opts.confirmLabel ?? 'Aceptar',
      resolve: (v) => resolve(typeof v === 'string' ? v : null)
    }
    emit()
  })
}

export function confirmDialog(opts: {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    current = {
      id: ++seq,
      kind: 'confirm',
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Aceptar',
      danger: opts.danger,
      resolve: (v) => resolve(v === true)
    }
    emit()
  })
}
