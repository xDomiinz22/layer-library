/**
 * Extrae la miniatura PNG que PrusaSlicer / OrcaSlicer / Bambu incrustan en el
 * G-code como bloque de comentarios base64:
 *
 *   ; thumbnail begin 220x124 8096
 *   ; iVBORw0KGgoAAAANSUhEUgAA...
 *   ; thumbnail end
 *
 * Devuelve la mayor encontrada, o null.
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
