/**
 * Iconos animados al estilo itshover.com (MIT): SVG 24×24 a trazo,
 * `currentColor`, animación disparada por hover con `motion/react`.
 * En vez de vendorizar sus componentes (pensados para el CLI de shadcn) se
 * reconstruyen aquí con la misma base técnica y un lenguaje de movimiento
 * propio: la mayoría comparte un "pop" de escala + giro suave; unas pocas
 * formas tienen un gesto específico que las representa mejor.
 */
import { motion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  className?: string
  /** Renderiza un SVG estático; la animación de hover la lleva el CSS del contenedor. */
  plain?: boolean
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

const pop: Variants = {
  rest: { scale: 1, rotate: 0 },
  hover: { scale: 1.14, rotate: -8, transition: { type: 'spring', stiffness: 420, damping: 11 } }
}

function IconBase({
  size = 18,
  className,
  variants = pop,
  plain,
  children
}: IconProps & { variants?: Variants; plain?: boolean; children: ReactNode }) {
  // `plain`: SVG estático (la animación de hover la lleva el CSS del contenedor,
  // p. ej. los iconos de la barra lateral). Sin él, el propio SVG reacciona a
  // su hover con `motion` — apto para botones donde el icono ≈ el control.
  if (plain) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className ? `ic-plain ${className}` : 'ic-plain'}
        {...STROKE}
      >
        {children}
      </svg>
    )
  }
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={variants}
      {...STROKE}
    >
      {children}
    </motion.svg>
  )
}

/* ---- Navegación ------------------------------------------------- */

export function LibraryIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </IconBase>
  )
}

export function DuplicateIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 5.5H6A1.5 1.5 0 0 0 4.5 7v9.5" />
    </IconBase>
  )
}

export function PrinterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 8.5V4h10v4.5" />
      <path d="M6 8.5h12a2.5 2.5 0 0 1 2.5 2.5v5H18v-3H6v3H3.5v-5A2.5 2.5 0 0 1 6 8.5Z" />
      <rect x="7.5" y="14" width="9" height="6" rx="1" />
      <path d="M17.5 11.5h.01" />
    </IconBase>
  )
}

// Colecciones: dos etiquetas apiladas.
export function CollectionsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 3.5h6.2a2 2 0 0 1 1.4.6l4.3 4.3a2 2 0 0 1 .6 1.4V16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
      <circle cx="10.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <path d="M4 8v11a2 2 0 0 0 2 2h9" />
    </IconBase>
  )
}

/* ---- Acciones -------------------------------------------------- */

// Lupa: se desplaza como si "buscara" en vez de rotar.
const searchMove: Variants = {
  rest: { x: 0, y: 0 },
  hover: { x: 1.6, y: 1.6, transition: { type: 'spring', stiffness: 500, damping: 14 } }
}
export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={{ rest: {}, hover: {} }}>
      <motion.g variants={searchMove}>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m20 20-4.3-4.3" />
      </motion.g>
    </IconBase>
  )
}

// X: las dos líneas se abren en abanico.
export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={{ rest: {}, hover: {} }}>
      <motion.path
        d="M18 6 6 18"
        style={{ transformOrigin: '50% 50%' }}
        variants={{ rest: { rotate: 0 }, hover: { rotate: 12, transition: { duration: 0.2 } } }}
      />
      <motion.path
        d="m6 6 12 12"
        style={{ transformOrigin: '50% 50%' }}
        variants={{ rest: { rotate: 0 }, hover: { rotate: -12, transition: { duration: 0.2 } } }}
      />
    </IconBase>
  )
}

// Refrescar: giro completo.
const spin: Variants = {
  rest: { rotate: 0 },
  hover: { rotate: 360, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
}
export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={spin}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.9-5.2L20 9" />
      <path d="M20 4.5V9h-4.5" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.9 5.2L4 15" />
      <path d="M4 19.5V15h4.5" />
    </IconBase>
  )
}

// Más: aparece con un giro de 90°.
const plusTurn: Variants = {
  rest: { rotate: 0, scale: 1 },
  hover: { rotate: 90, scale: 1.15, transition: { type: 'spring', stiffness: 380, damping: 12 } }
}
export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={plusTurn}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  )
}

export function FolderPlusIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={plusTurn}>
      <path d="M4 7a2 2 0 0 1 2-2h3.2a2 2 0 0 1 1.4.6L12 7h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M12 11v5" />
      <path d="M9.5 13.5h5" />
    </IconBase>
  )
}

// Papelera: la tapa se levanta.
export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={{ rest: {}, hover: {} }}>
      <motion.path
        d="M4 7h16"
        style={{ transformOrigin: '50% 50%' }}
        variants={{ rest: { y: 0, rotate: 0 }, hover: { y: -1.5, rotate: -10, transition: { duration: 0.25 } } }}
      />
      <motion.path
        d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7"
        variants={{ rest: { y: 0 }, hover: { y: -1.5, transition: { duration: 0.25 } } }}
      />
      <path d="M6 7.5 7 19a2 2 0 0 0 2 1.8h6A2 2 0 0 0 17 19l1-11.5" />
      <path d="M10 11v6M14 11v6" />
    </IconBase>
  )
}

export function OpenIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13 4h7v7" />
      <path d="M20 4 11 13" />
      <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
    </IconBase>
  )
}

export function FolderOpenIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 8V6.5A1.5 1.5 0 0 1 5.5 5h3.8a1.5 1.5 0 0 1 1 .4L11.5 7H18a1.5 1.5 0 0 1 1.5 1.5V9" />
      <path d="m3.6 10.5 1.5 7A1.6 1.6 0 0 0 6.7 19h10.9a1.6 1.6 0 0 0 1.5-1.2l1.4-6a1 1 0 0 0-1-1.3H4.6a1 1 0 0 0-1 1Z" />
    </IconBase>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 5.5H6A1.5 1.5 0 0 0 4.5 7v9.5" />
    </IconBase>
  )
}

// Check: se dibuja de un trazo.
export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={{ rest: {}, hover: {} }}>
      <motion.path
        d="m5 13 4 4 10-11"
        variants={{
          rest: { pathLength: 1 },
          hover: { pathLength: [0, 1], transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
        }}
      />
    </IconBase>
  )
}

export function UndoIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={{ rest: { rotate: 0 }, hover: { rotate: -20 } }}>
      <path d="M9 7 4.5 11 9 15" />
      <path d="M4.5 11h9A5.5 5.5 0 0 1 19 16.5v0A5.5 5.5 0 0 1 13.5 22" />
    </IconBase>
  )
}

const nudgeUp: Variants = { rest: { y: 0 }, hover: { y: -2, transition: { type: 'spring', stiffness: 500, damping: 12 } } }
const nudgeDown: Variants = { rest: { y: 0 }, hover: { y: 2, transition: { type: 'spring', stiffness: 500, damping: 12 } } }
export function ArrowUpIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={nudgeUp}>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </IconBase>
  )
}
export function ArrowDownIcon(props: IconProps) {
  return (
    <IconBase {...props} variants={nudgeDown}>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </IconBase>
  )
}

export function ChevronIcon({ open, ...props }: IconProps & { open?: boolean }) {
  return (
    <motion.svg
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 24 24"
      className={props.className}
      animate={{ rotate: open ? 90 : 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...STROKE}
    >
      <path d="m9 6 6 6-6 6" />
    </motion.svg>
  )
}

/* ---- Glifo de formato para tarjetas sin miniatura ------------- */

export function FormatGlyph({ format, size = 34 }: { format: string; size?: number }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' as const }
  if (format === '3mf')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <path d="M12 3 4 7v10l8 4 8-4V7Z" />
        <path d="m4 7 8 4 8-4M12 11v10" />
      </svg>
    )
  if (format === 'gcode')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <path d="M3 12h3l2-6 4 12 3-9 2 3h4" />
      </svg>
    )
  if (format === 'step')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
        <path d="M12 2.5 20 7v10l-8 4.5L4 17V7Z" />
        <path d="M12 12v9.5M4 7l8 5 8-5" />
      </svg>
    )
  // stl / obj — poliedro
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  )
}
