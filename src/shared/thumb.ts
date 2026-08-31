/** Contrato IPC entre el proceso principal y la ventana oculta de miniaturas. */

import type { MeshMeta } from './types'

export interface ThumbJob {
  id: number
  format: 'stl' | '3mf'
  /** Contenido del archivo. */
  buffer: ArrayBuffer
  size: number
}

export interface ThumberBridge {
  ready(): void
  onJob(cb: (job: ThumbJob) => void): void
  done(id: number, pngBase64: string, meta: MeshMeta | null): void
  fail(id: number, error: string): void
}
