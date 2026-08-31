# Layer Library

Biblioteca **local** para archivos de impresión 3D (STL, 3MF, …): miniaturas reales,
búsqueda instantánea, detección de duplicados y cola de impresión. Inspirada en
[LayerMate](https://www.layermate.app/). Nada sale de tu equipo.

## Stack

- **Electron** + `electron-vite`
- **React 19** + TypeScript (renderer)
- **better-sqlite3** con FTS5 (índice y búsqueda)
- **chokidar** (escaneo incremental + watch)
- **three** (render de miniaturas STL en ventana oculta)

## Desarrollo

```bash
npm install        # compila better-sqlite3 contra Electron (postinstall)
npm run dev         # arranca la app con HMR
```

Requisitos en Windows: VS Build Tools con toolset C++ y Python 3 (para node-gyp).

## Estructura

```
src/
  main/      proceso principal: ventana, DB, IPC, escaneo (Node)
  preload/   puente contextIsolation -> window.api
  renderer/  UI React
  shared/    tipos compartidos main <-> renderer
```

## Roadmap

- [x] **Fase 0** — Scaffold, ventana, DB, alta/baja de carpetas raíz (locales, externas, red)
- [ ] **Fase 1** — Escaneo recursivo STL/3MF, indexado incremental, hashing, watch en vivo
- [ ] **Fase 2** — Miniaturas: PNG embebido de 3MF + render MatCap de STL, cola en segundo plano
- [ ] **Fase 3** — Cuadrícula virtualizada, búsqueda FTS, filtros, panel de detalle
- [ ] **Fase 4** — Duplicados por hash, cola de impresión, colecciones/creadores
- [ ] **Fase 5** — OBJ/STEP/GCODE, empaquetado `electron-builder`, temas
```
