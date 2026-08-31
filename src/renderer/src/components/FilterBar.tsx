import type { DateWindow, FileSort, ModelFormat } from '@shared/types'
import { DuplicateIcon } from './icons'

export interface Filters {
  formats: ModelFormat[]
  dateWindow: DateWindow
  sort: FileSort
  onlyDuplicates: boolean
}

export const DEFAULT_FILTERS: Filters = {
  formats: [],
  dateWindow: 'any',
  sort: 'recent',
  onlyDuplicates: false
}

const DATE_LABELS: Record<DateWindow, string> = {
  any: 'Cualquier fecha',
  '24h': 'Últimas 24 h',
  '7d': 'Última semana',
  '30d': 'Último mes',
  '365d': 'Último año'
}

const SORT_LABELS: Record<FileSort, string> = {
  recent: 'Más recientes',
  oldest: 'Más antiguos',
  name: 'Nombre (A→Z)',
  size: 'Tamaño (↓)',
  'size-asc': 'Tamaño (↑)',
  time: 'Tiempo impresión (↓)',
  'time-asc': 'Tiempo impresión (↑)',
  grams: 'Filamento (↓)'
}

const CARD_SIZES = [132, 168, 216]

export function FilterBar({
  filters,
  onChange,
  formats,
  cardSize,
  onCardSize,
  count
}: {
  filters: Filters
  onChange: (f: Filters) => void
  formats: ModelFormat[]
  cardSize: number
  onCardSize: (s: number) => void
  count: number
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]): void =>
    onChange({ ...filters, [k]: v })

  const toggleFormat = (fmt: ModelFormat): void => {
    const next = filters.formats.includes(fmt)
      ? filters.formats.filter((x) => x !== fmt)
      : [...filters.formats, fmt]
    set('formats', next)
  }

  const dirty =
    filters.formats.length > 0 || filters.dateWindow !== 'any' || filters.onlyDuplicates

  return (
    <div className="filterbar">
      <div className="chips">
        {formats.map((fmt) => (
          <button
            key={fmt}
            className={`chip${filters.formats.includes(fmt) ? ' on' : ''}`}
            onClick={() => toggleFormat(fmt)}
          >
            {fmt.toUpperCase()}
          </button>
        ))}
        <button
          className={`chip chip-ic${filters.onlyDuplicates ? ' on' : ''}`}
          onClick={() => set('onlyDuplicates', !filters.onlyDuplicates)}
          title="Mostrar solo archivos duplicados"
        >
          <DuplicateIcon size={13} plain />
          Duplicados
        </button>
      </div>

      <select
        className="sel"
        value={filters.dateWindow}
        onChange={(e) => set('dateWindow', e.target.value as DateWindow)}
      >
        {(Object.keys(DATE_LABELS) as DateWindow[]).map((k) => (
          <option key={k} value={k}>
            {DATE_LABELS[k]}
          </option>
        ))}
      </select>

      <select
        className="sel"
        value={filters.sort}
        onChange={(e) => set('sort', e.target.value as FileSort)}
      >
        {(Object.keys(SORT_LABELS) as FileSort[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>

      {dirty && (
        <button
          className="btn ghost sm"
          onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
        >
          Limpiar
        </button>
      )}

      <span className="fb-count">{count.toLocaleString('es')}</span>

      <div className="size-toggle">
        {CARD_SIZES.map((s, i) => (
          <button
            key={s}
            className={s === cardSize ? 'on' : ''}
            onClick={() => onCardSize(s)}
            title={['Pequeño', 'Mediano', 'Grande'][i]}
          >
            {['S', 'M', 'L'][i]}
          </button>
        ))}
      </div>
    </div>
  )
}

export { CARD_SIZES }
