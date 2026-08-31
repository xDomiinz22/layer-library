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
  /** Estado del último/actual escaneo de esta raíz. */
  scanState: ScanPhase
}

export type ModelFormat = 'stl' | '3mf' | 'obj' | 'step' | 'gcode'

export const SCANNED_FORMATS: ModelFormat[] = ['stl', '3mf']

export type ThumbStatus = 'pending' | 'ready' | 'failed' | 'none'

export type ScanPhase = 'idle' | 'walking' | 'hashing' | 'thumbnails' | 'done' | 'error'

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
  /** Hash sha256 del contenido (hex). null hasta calcularse. */
  hash: string | null
  thumbStatus: ThumbStatus
  thumbFile: string | null
  addedAt: number
  /** Nº de triángulos de la malla (null si no se ha renderizado). */
  triCount: number | null
  /** Caja envolvente en unidades del archivo (mm normalmente); null si desconocida. */
  dim: [number, number, number] | null
}

/** Metadatos de malla calculados al renderizar la miniatura. */
export interface MeshMeta {
  triCount: number
  dim: [number, number, number]
}

export interface ScanProgress {
  rootId: number | null
  phase: ScanPhase
  /** Archivos descubiertos en el recorrido. */
  discovered: number
  /** Archivos procesados (hasheados) en la fase de hashing. */
  processed: number
  /** Total a procesar en la fase actual. */
  total: number
  message?: string
}

export interface FormatCount {
  format: ModelFormat
  count: number
  size: number
}

export interface LibraryStats {
  totalFiles: number
  totalSize: number
  byFormat: FormatCount[]
  pendingHash: number
  pendingThumb: number
  /** Nº de grupos de duplicados (mismo hash, >1 archivo). */
  duplicateGroups: number
  /** Nº de archivos que son copia redundante (total en grupos - 1 por grupo). */
  duplicateFiles: number
  /** Bytes recuperables si se dejara una copia por grupo. */
  wastedBytes: number
}

export type FileSort = 'recent' | 'oldest' | 'name' | 'size' | 'size-asc'

export type DateWindow = 'any' | '24h' | '7d' | '30d' | '365d'

export interface ListFilesOptions {
  query?: string
  formats?: ModelFormat[]
  rootId?: number | null
  sort?: FileSort
  dateWindow?: DateWindow
  onlyDuplicates?: boolean
  limit?: number
  offset?: number
}

export interface ListFilesResult {
  items: ModelFile[]
  total: number
}

export interface DuplicateSibling {
  id: number
  path: string
  relPath: string
  rootLabel: string
}

export interface FileDetail {
  file: ModelFile
  rootLabel: string
  rootPath: string
  /** Otros archivos con el mismo hash (sin incluir este). */
  duplicates: DuplicateSibling[]
}

/** Contrato del puente expuesto en window.api (ver preload). */
export interface LayerApi {
  listRoots(): Promise<LibraryRoot[]>
  addRoot(): Promise<LibraryRoot | null>
  addRootPath(path: string): Promise<LibraryRoot | null>
  removeRoot(id: number): Promise<void>
  renameRoot(id: number, label: string): Promise<void>
  rescanAll(): Promise<void>
  rescanRoot(id: number): Promise<void>
  getStats(): Promise<LibraryStats>
  listFiles(opts: ListFilesOptions): Promise<ListFilesResult>
  getFileDetail(id: number): Promise<FileDetail | null>
  revealInExplorer(path: string): Promise<void>
  openFile(path: string): Promise<void>
  copyText(text: string): Promise<void>
  appVersion(): Promise<string>
  /** Eventos de progreso de escaneo/hashing. Devuelve función para desuscribir. */
  onScanProgress(cb: (p: ScanProgress) => void): () => void
  /** Se emite cuando cambia el conjunto de archivos (tras escaneo, watch, prune). */
  onLibraryChanged(cb: () => void): () => void
}
