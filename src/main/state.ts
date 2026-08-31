import type { ScanPhase } from '../shared/types'

/** Estado de escaneo en memoria por raíz (no se persiste). */
const scanState = new Map<number, ScanPhase>()

export function getScanState(rootId: number): ScanPhase {
  return scanState.get(rootId) ?? 'idle'
}

export function setScanState(rootId: number, phase: ScanPhase): void {
  if (phase === 'idle') scanState.delete(rootId)
  else scanState.set(rootId, phase)
}

export function anyScanning(): boolean {
  for (const p of scanState.values()) {
    if (p === 'walking' || p === 'hashing') return true
  }
  return false
}
