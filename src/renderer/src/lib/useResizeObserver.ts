import { useEffect, useState, type RefObject } from 'react'

/** Devuelve el ancho en píxeles del elemento referenciado, reactivo. */
export function useResizeObserver(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return width
}
