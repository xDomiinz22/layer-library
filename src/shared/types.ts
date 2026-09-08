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

/** Formatos que el escáner indexa. */
export const SCANNED_FORMATS: ModelFormat[] = ['stl', '3mf', 'obj', 'step', 'gcode']

/** Extensiones aceptadas por formato (para el walker). */
export const FORMAT_EXTENSIONS: Record<ModelFormat, string[]> = {
  stl: ['stl'],
  '3mf': ['3mf'],
  obj: ['obj'],
  step: ['step', 'stp'],
  gcode: ['gcode', 'gco', 'g']
}

export type ThumbStatus = 'pending' | 'ready' | 'failed' | 'none'

export type ScanPhase =
  | 'idle'
  | 'walking'
  | 'hashing'
  | 'thumbnails'
  | 'metadata'
  | 'slicing'
  | 'done'
  | 'error'

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
  /** Tiempo de impresión estimado en segundos (suma de todos los platos). null si no aplica. */
  printSeconds: number | null
  /** Gramos de filamento (suma de todos los platos). */
  filamentG: number | null
  /** Tipos de filamento distintos, p. ej. ['PLA', 'PETG']. */
  filamentTypes: string[]
  /** Colores de filamento distintos en hex, p. ej. ['#000000', '#FF8000']. */
  filamentColors: string[]
  /** Nº de platos del 3MF (null para gcode / sin datos). */
  plateCount: number | null
  /** Origen de los datos de impresión: 'file' (leídos del 3MF/gcode) o 'sliced'
   * (calculados relaminando con el slicer). null si no hay datos. */
  printSource: 'file' | 'sliced' | null
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
  /** Archivos 3MF/GCODE sin metadatos de impresión leídos aún. */
  pendingMeta: number
  /** Nº de grupos de duplicados (mismo hash, >1 archivo). */
  duplicateGroups: number
  /** Nº de archivos que son copia redundante (total en grupos - 1 por grupo). */
  duplicateFiles: number
  /** Bytes recuperables si se dejara una copia por grupo. */
  wastedBytes: number
}

export type FileSort =
  | 'recent'
  | 'oldest'
  | 'name'
  | 'size'
  | 'size-asc'
  | 'time'
  | 'time-asc'
  | 'grams'

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
  /** Ids de colecciones a las que pertenece. */
  collectionIds: number[]
  /** true si está en la cola de impresión. */
  inQueue: boolean
}

// --- Duplicados ------------------------------------------------------

export interface DuplicateGroupMember {
  id: number
  path: string
  relPath: string
  rootId: number
  rootLabel: string
  mtimeMs: number
}

export interface DuplicateGroup {
  hash: string
  size: number
  /** size * (count - 1) */
  wasted: number
  thumbFile: string | null
  members: DuplicateGroupMember[]
}

// --- Colecciones ---------------------------------------------------

export type CollectionKind = 'collection' | 'creator'

export interface Collection {
  id: number
  name: string
  kind: CollectionKind
  fileCount: number
}

// --- Cola de impresión -------------------------------------------

export interface Printer {
  id: number
  name: string
}

export interface QueueItem {
  id: number
  file: ModelFile
  printerId: number | null
  sort: number
  printed: boolean
  addedAt: number
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
  getStats(rootId?: number | null): Promise<LibraryStats>
  listFiles(opts: ListFilesOptions): Promise<ListFilesResult>
  getFileDetail(id: number): Promise<FileDetail | null>
  revealInExplorer(path: string): Promise<void>
  openFile(path: string): Promise<void>
  copyText(text: string): Promise<void>
  /** Mueve archivos a la papelera del sistema (pide confirmación al usuario). Devuelve cuántos se movieron. */
  trashFiles(ids: number[]): Promise<number>

  listDuplicateGroups(): Promise<DuplicateGroup[]>

  listCollections(): Promise<Collection[]>
  createCollection(name: string, kind: CollectionKind): Promise<Collection>
  renameCollection(id: number, name: string): Promise<void>
  deleteCollection(id: number): Promise<void>
  setFileCollection(fileId: number, collectionId: number, member: boolean): Promise<void>
  listCollectionFiles(collectionId: number): Promise<ModelFile[]>

  listPrinters(): Promise<Printer[]>
  createPrinter(name: string): Promise<Printer>
  renamePrinter(id: number, name: string): Promise<void>
  deletePrinter(id: number): Promise<void>
  listQueue(): Promise<QueueItem[]>
  addToQueue(fileId: number, printerId: number | null): Promise<void>
  /** Añade si no está, quita si ya está. Devuelve el nuevo estado. */
  toggleQueue(fileId: number): Promise<boolean>
  removeFromQueue(itemId: number): Promise<void>
  updateQueueItem(itemId: number, patch: { printerId?: number | null; printed?: boolean }): Promise<void>
  moveQueueItem(itemId: number, direction: 'up' | 'down'): Promise<void>

  /** true si hay un slicer (Bambu Studio / OrcaSlicer) disponible para relaminar. */
  slicerAvailable(): Promise<boolean>
  /** Relamina un 3MF/gcode con el slicer para obtener tiempo y gramos. En cola, uno a uno. */
  sliceForStats(id: number): Promise<{ ok: boolean; error?: string }>

  appVersion(): Promise<string>
  /** Eventos de progreso de escaneo/hashing. Devuelve función para desuscribir. */
  onScanProgress(cb: (p: ScanProgress) => void): () => void
  /** Se emite cuando cambia el conjunto de archivos (tras escaneo, watch, prune). */
  onLibraryChanged(cb: () => void): () => void
}
