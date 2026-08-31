/**
 * Marca de Layer Library — derivada del logotipo de R3D: mismo lenguaje
 * geométrico y motivo de extrusor de impresora 3D, aquí sobre una pila de
 * capas (el concepto de "Layer") y en el naranja de la app.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* extrusor */}
      <path
        d="M8.5 3.5h7l-1.6 4.2a1 1 0 0 1-.94.65h-1.92a1 1 0 0 1-.94-.65Z"
        fill="currentColor"
      />
      {/* hilo extruido */}
      <path
        d="M12 8.4c0 1.4-1 1.9-1 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* pila de capas (base más ancha, como una impresión real) */}
      <rect x="8" y="11.6" width="8" height="2.9" rx="1.45" fill="currentColor" opacity="0.5" />
      <rect x="5.8" y="15.2" width="12.4" height="3" rx="1.5" fill="currentColor" opacity="0.78" />
      <rect x="4" y="18.9" width="16" height="3.1" rx="1.55" fill="currentColor" />
    </svg>
  )
}

export function Logo() {
  return (
    <div className="logo">
      <span className="logo-mark">
        <LogoMark size={22} />
      </span>
      <span className="logo-word">
        Layer <span className="logo-word-accent">Library</span>
      </span>
    </div>
  )
}
