import { unzipSync } from 'fflate'

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
