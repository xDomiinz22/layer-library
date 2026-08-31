import type { LayerApi } from '../shared/types'

declare global {
  interface Window {
    api: LayerApi
  }
}

export {}
