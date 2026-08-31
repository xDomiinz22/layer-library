/** Cola de avisos efímeros, con suscripción para el <Toaster>. */

export interface Toast {
  id: number
  text: string
  tone: 'default' | 'success' | 'danger'
}

let seq = 0
let toasts: Toast[] = []
const listeners = new Set<(t: Toast[]) => void>()

function emit(): void {
  for (const l of listeners) l(toasts)
}

export function subscribeToasts(cb: (t: Toast[]) => void): () => void {
  listeners.add(cb)
  cb(toasts)
  return () => listeners.delete(cb)
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toast(text: string, tone: Toast['tone'] = 'default'): void {
  const id = ++seq
  toasts = [...toasts, { id, text, tone }].slice(-4)
  emit()
  setTimeout(() => dismissToast(id), 2800)
}
