# Layer Library

Biblioteca **local** para archivos de impresión 3D (STL, 3MF, …): miniaturas reales,
búsqueda instantánea, detección de duplicados y cola de impresión. Inspirada en
[LayerMate](https://www.layermate.app/). Nada sale de tu equipo.

## Stack

- **Electron 38** + `electron-vite`
- **React 19** + TypeScript (renderer)
- **`node:sqlite`** con FTS5 (índice y búsqueda) — sin módulos nativos que compilar
- **chokidar** (escaneo incremental + watch)
- **three** (render de miniaturas STL en ventana oculta)

## Desarrollo

```bash
npm install
npm run dev
```

Sin dependencias nativas: no hace falta toolchain de C++.

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
- [x] **Fase 1** — Escaneo recursivo STL/3MF, indexado incremental, hashing (sha256), watch en vivo
- [x] **Fase 2** — Miniaturas: PNG embebido de 3MF + render STL/3MF con Three.js, cola en segundo plano, grid de tarjetas
- [x] **Fase 3** — Cuadrícula virtualizada, filtros (formato/biblioteca/fecha/duplicados), panel de detalle con metadatos de malla
- [x] **Fase 4** — Vista de duplicados + borrado a Papelera, cola de impresión por impresora, colecciones/creadores
- [ ] **Fase 5** — OBJ/STEP/GCODE, empaquetado `electron-builder`, temas
```
