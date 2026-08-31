import { unzipSync } from 'fflate'
import type { PrintInfo } from './db'

/**
 * Extrae la mejor miniatura PNG embebida de un 3MF (los slicers Bambu / Orca /
 * Prusa la incrustan bajo Metadata/). Devuelve null si no hay ninguna.
 */
export function extract3mfThumbnail(buf: Uint8Array): Uint8Array | null {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(buf, {
      filter: (f) => /\.png$/i.test(f.name) && f.size > 0
    })
  } catch {
    return null
  }

  let best: { data: Uint8Array; score: number } | null = null
  for (const [name, data] of Object.entries(files)) {
    if (data.length < 128) continue
    const lower = name.toLowerCase()
    let score = data.length // a igualdad de tipo, la más grande gana
    if (/metadata\/plate_\d+\.png$/.test(lower)) score += 50_000_000
    else if (/metadata\/top_\d+\.png$/.test(lower)) score += 20_000_000
    else if (/thumbnail\.png$/.test(lower)) score += 30_000_000
    else if (/metadata\/plate_\d+_small\.png$/.test(lower)) score += 10_000_000
    else if (/(pick|no_light)/.test(lower)) score -= 40_000_000
    if (!best || score > best.score) best = { data, score }
  }
  return best?.data ?? null
}

// --- Metadatos de impresión ---------------------------------------

function normType(t: string): string {
  const u = t.trim().toUpperCase()
  return u === 'PLA-CF' || u === 'PLA+' ? 'PLA' : u
}

function normColor(c: string): string {
  let s = c.trim().toUpperCase()
  if (!s.startsWith('#')) s = '#' + s
  // #RRGGBBAA -> #RRGGBB
  if (/^#[0-9A-F]{8}$/.test(s)) s = s.slice(0, 7)
  return /^#[0-9A-F]{6}$/.test(s) ? s : ''
}

/**
 * Lee tiempo estimado, gramos y filamentos de un 3MF de Bambu Studio / OrcaSlicer
 * (Metadata/slice_info.config), sumando todos los platos. Cae a
 * project_settings.config o al perfil de PrusaSlicer para tipo/color si no hay
 * datos de laminado. Devuelve null si el archivo no contiene nada útil.
 */
export function extract3mfPrintInfo(buf: Uint8Array): PrintInfo | null {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(buf, {
      filter: (f) =>
        /metadata\/(slice_info|project_settings|slic3r_pe)\.config$/i.test(f.name) && f.size > 0
    })
  } catch {
    return null
  }
  const get = (re: RegExp): string | null => {
    const key = Object.keys(files).find((k) => re.test(k))
    return key ? Buffer.from(files[key]).toString('utf8') : null
  }

  const types = new Set<string>()
  const colors = new Set<string>()
  let seconds = 0
  let grams = 0
  let hadSlice = false
  let plates = 0

  const slice = get(/slice_info\.config$/i)
  if (slice) {
    for (const block of slice.split(/<plate>/i).slice(1)) {
      const plate = block.split(/<\/plate>/i)[0]
      plates++
      const pred = /key="prediction"\s+value="([\d.]+)"/i.exec(plate)
      const wt = /key="weight"\s+value="([\d.]+)"/i.exec(plate)
      if (pred) {
        seconds += Math.round(parseFloat(pred[1]))
        hadSlice = true
      }
      if (wt) {
        grams += parseFloat(wt[1])
        hadSlice = true
      }
      for (const fm of plate.matchAll(/<filament\b[^>]*>/gi)) {
        const tag = fm[0]
        const t = /\btype="([^"]+)"/i.exec(tag)
        const c = /\bcolor="([^"]+)"/i.exec(tag)
        if (t) types.add(normType(t[1]))
        if (c) {
          const nc = normColor(c[1])
          if (nc) colors.add(nc)
        }
      }
    }
  }

  // Fallbacks para tipo/color (no dan tiempo ni gramos).
  if (types.size === 0 || colors.size === 0) {
    const proj = get(/project_settings\.config$/i)
    if (proj) {
      for (const m of proj.matchAll(/"filament_type"\s*:\s*\[([^\]]*)\]/gi))
        for (const v of m[1].matchAll(/"([^"]+)"/g)) types.add(normType(v[1]))
      for (const m of proj.matchAll(/"filament_colour"\s*:\s*\[([^\]]*)\]/gi))
        for (const v of m[1].matchAll(/"([^"]+)"/g)) {
          const nc = normColor(v[1])
          if (nc) colors.add(nc)
        }
    }
    const prusa = get(/slic3r_pe\.config$/i)
    if (prusa) {
      const t = /^filament_type\s*=\s*(.+)$/im.exec(prusa)
      const c = /^filament_colou?r\s*=\s*(.+)$/im.exec(prusa)
      if (t) t[1].split(/[;,]/).forEach((x) => x.trim() && types.add(normType(x)))
      if (c)
        c[1].split(/[;,]/).forEach((x) => {
          const nc = normColor(x)
          if (nc) colors.add(nc)
        })
    }
  }

  if (!hadSlice && types.size === 0 && colors.size === 0) return null
  return {
    seconds: hadSlice && seconds > 0 ? seconds : null,
    grams: hadSlice && grams > 0 ? Math.round(grams * 10) / 10 : null,
    types: [...types],
    colors: [...colors],
    plates: plates > 0 ? plates : null
  }
}
