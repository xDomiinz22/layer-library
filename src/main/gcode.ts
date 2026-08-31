import type { PrintInfo } from './db'

/**
 * Extrae la miniatura PNG que PrusaSlicer / OrcaSlicer / Bambu incrustan en el
 * G-code como bloque de comentarios base64.
 */
export function extractGcodeThumbnail(buf: Uint8Array): Uint8Array | null {
  // `buf` ya viene recortado (cabecera + cola) por el llamador.
  const text = Buffer.from(buf).toString('latin1')

  const re = /;\s*thumbnail(?:_[A-Z]+)?\s+begin[^\n]*\n([\s\S]*?);\s*thumbnail(?:_[A-Z]+)?\s+end/gi
  let best: Uint8Array | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const b64 = m[1].replace(/;/g, '').replace(/\s+/g, '')
    if (b64.length < 128) continue
    try {
      const png = Buffer.from(b64, 'base64')
      if (png.length > 67 && png[0] === 0x89 && png[1] === 0x50) {
        if (!best || png.length > best.length) best = png
      }
    } catch {
      /* base64 corrupto */
    }
  }
  return best
}

// --- Metadatos de impresión --------------------------------------

function parseDuration(s: string): number | null {
  // "1h 47m 12s" | "47m 12s" | "1d 2h" | "1:47:12"
  s = s.trim()
  const colon = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(s)
  if (colon) return +colon[1] * 3600 + +colon[2] * 60 + +colon[3]
  let total = 0
  let hit = false
  for (const m of s.matchAll(/([\d.]+)\s*([dhms])/gi)) {
    hit = true
    const n = parseFloat(m[1])
    total += n * ({ d: 86400, h: 3600, m: 60, s: 1 } as Record<string, number>)[m[2].toLowerCase()]
  }
  return hit ? Math.round(total) : null
}

/**
 * Lee tiempo estimado, gramos y filamentos de la cabecera de comentarios de un
 * G-code (PrusaSlicer / SuperSlicer / OrcaSlicer / Bambu / Cura). `text` es la
 * cabecera + cola del archivo. Devuelve null si no hay nada útil.
 */
export function extractGcodeInfo(text: string): PrintInfo | null {
  const line = (re: RegExp): string | null => re.exec(text)?.[1]?.trim() ?? null

  // --- tiempo ---
  let seconds: number | null = null
  const cura = line(/^;TIME:(\d+)/im)
  if (cura) seconds = parseInt(cura, 10)
  if (seconds == null) {
    const t =
      line(/estimated printing time \(normal mode\)\s*=\s*(.+)$/im) ||
      line(/total estimated time:\s*(.+)$/im) ||
      line(/;\s*model printing time:\s*(.+?)(?:;|$)/im) ||
      line(/estimated printing time\s*=\s*(.+)$/im)
    if (t) seconds = parseDuration(t)
  }

  // --- gramos ---
  let grams: number | null = null
  const total = line(/total filament used \[g\]\s*=\s*([\d.]+)/im)
  if (total) grams = parseFloat(total)
  if (grams == null) {
    let sum = 0
    let hit = false
    for (const m of text.matchAll(/filament used \[g\]\s*=\s*([\d.]+)/gi)) {
      sum += parseFloat(m[1])
      hit = true
    }
    if (hit) grams = sum
  }
  if (grams == null) {
    // estimación desde volumen (cm³ · densidad ≈ 1.24 g/cm³ para PLA)
    const cm3 = line(/filament used \[cm3\]\s*=\s*([\d.]+)/im)
    if (cm3) grams = Math.round(parseFloat(cm3) * 1.24 * 10) / 10
  }
  if (grams != null) grams = Math.round(grams * 10) / 10

  // --- tipos ---
  const types = new Set<string>()
  const ft = line(/^;\s*filament_type\s*=\s*(.+)$/im)
  if (ft) ft.replace(/["']/g, '').split(/[;,]/).forEach((x) => x.trim() && types.add(x.trim().toUpperCase()))
  for (const m of text.matchAll(/^;.*MATERIAL\.TYPE:(\w+)/gim)) types.add(m[1].toUpperCase())

  // --- colores ---
  const colors = new Set<string>()
  const fc = line(/^;\s*(?:filament[_ ]colou?r|extruder_colour)\s*=\s*(.+)$/im)
  if (fc)
    for (const m of fc.matchAll(/#?[0-9A-Fa-f]{6}/g)) {
      const c = m[0].startsWith('#') ? m[0].toUpperCase() : '#' + m[0].toUpperCase()
      colors.add(c)
    }

  if (seconds == null && grams == null && types.size === 0 && colors.size === 0) return null
  return { seconds, grams, types: [...types], colors: [...colors], plates: null }
}
