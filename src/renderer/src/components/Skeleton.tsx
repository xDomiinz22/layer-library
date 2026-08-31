/** Rejilla de tarjetas fantasma mientras se carga la biblioteca. */
export function GridSkeleton({ size, count = 18 }: { size: number; count?: number }) {
  return (
    <div className="grid-scroll">
      <div
        className="skeleton-grid"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div className="sk-card" key={i} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
            <div className="sk-thumb" />
            <div className="sk-line" />
            <div className="sk-line short" />
          </div>
        ))}
      </div>
    </div>
  )
}
