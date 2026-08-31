export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function formatCount(n: number): string {
  return n.toLocaleString('es')
}

export function formatDims(dim: [number, number, number] | null): string {
  if (!dim) return '—'
  const [x, y, z] = dim.map((n) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10))
  return `${x} × ${y} × ${z} mm`
}

export function formatTris(n: number | null): string {
  if (n == null) return '—'
  if (n < 1000) return `${n} tri`
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)} K tri`
  return `${(n / 1_000_000).toFixed(1)} M tri`
}

export function fullDate(ms: number): string {
  return new Date(ms).toLocaleString('es', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function relativeTime(ms: number | null): string {
  if (!ms) return 'nunca'
  const diff = Date.now() - ms
  const min = Math.round(diff / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return `hace ${d} d`
}
