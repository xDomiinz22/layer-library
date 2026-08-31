import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const here = dirname(fileURLToPath(import.meta.url))
const r = (p) => resolve(here, p)

// Servidor solo-UI para iterar el renderer sin Electron (usa devApi mock).
export default defineConfig({
  root: r('src/renderer'),
  resolve: {
    alias: {
      '@renderer': r('src/renderer/src'),
      '@shared': r('src/shared')
    }
  },
  plugins: [react()]
})
