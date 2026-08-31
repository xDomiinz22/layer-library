import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

function boot(): void {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

if (import.meta.env.DEV && !(window as { api?: unknown }).api) {
  import('./lib/devApi').then((m) => {
    m.installDevApi()
    boot()
  })
} else {
  boot()
}
