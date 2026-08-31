/** Tipos compartidos entre proceso principal (Node) y renderer (React). */

export type RootKind = 'local' | 'external' | 'network'

export interface LibraryRoot {
  id: number
  /** Ruta absoluta de la carpeta raíz (puede ser letra de unidad, UNC de red, etc.). */
  path: string
  /** Nombre visible editable por el usuario. */
  label: string
  kind: RootKind
  /** true si la ruta es accesible ahora mismo. */
  online: boolean
  addedAt: number
  lastScanAt: number | null
  fileCount: number
}

export type ModelFormat = 'stl' | '3mf' | 'obj' | 'step' | 'gcode'

export type ThumbStatus = 'pending' | 'ready' | 'failed' | 'none'

export interface ModelFile {
  id: number
  rootId: number
  /** Ruta absoluta. */
  path: string
  /** Ruta relativa a la raíz, con separadores '/'. */
  relPath: string
  name: string
  format: ModelFormat
  size: number
  mtimeMs: number
  /** Hash xxhash64 del contenido (hex). null hasta calcularse. */
  hash: string | null
  thumbStatus: ThumbStatus
  /** Nombre de fichero del PNG en la caché de miniaturas. */
  thumbFile: string | null
  addedAt: number
}

export interface ScanProgress {
  rootId: number
  phase: 'walking' | 'hashing' | 'thumbnails' | 'done' | 'error'
  discovered: number
  processed: number
  message?: string
}

/** Contrato del puente expuesto en window.api (ver preload). */
export interface LayerApi {
  listRoots(): Promise<LibraryRoot[]>
  addRoot(): Promise<LibraryRoot | null>
  addRootPath(path: string): Promise<LibraryRoot | null>
  removeRoot(id: number): Promise<void>
  renameRoot(id: number, label: string): Promise<void>
  revealInExplorer(path: string): Promise<void>
  appVersion(): Promise<string>
}
