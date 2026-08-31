/**
 * Renderizador de miniaturas. Corre en una ventana oculta de Electron.
 * Recibe archivos STL/3MF del proceso principal, los rinde con Three.js
 * y devuelve un PNG en base64 + metadatos de malla.
 */
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { ThumbJob, ThumberBridge } from '@shared/thumb'
import type { MeshMeta } from '@shared/types'

declare global {
  interface Window {
    thumber: ThumberBridge
  }
}

const SIZE = 512
const MAX_BYTES = 250 * 1024 * 1024

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true
})
renderer.setSize(SIZE, SIZE)
renderer.setClearColor(0x000000, 0)
renderer.setPixelRatio(1)

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100000)

const stlMaterial = new THREE.MeshStandardMaterial({
  color: 0xc4c8d0,
  roughness: 0.72,
  metalness: 0.04,
  flatShading: true,
  side: THREE.DoubleSide
})

function buildScene(): THREE.Scene {
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4a, 2.1))
  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(1, 1.6, 1.1)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.8)
  fill.position.set(-1.4, -0.4, -1)
  scene.add(fill)
  return scene
}

function meshStats(object: THREE.Object3D): MeshMeta {
  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  const s = box.getSize(new THREE.Vector3())
  let tris = 0
  object.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    const g = m.geometry
    tris += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3
  })
  return {
    triCount: Math.round(tris),
    dim: [round2(s.x), round2(s.y), round2(s.z)]
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function frameAndRender(object: THREE.Object3D): void {
  const wrap = new THREE.Group()
  wrap.add(object)
  wrap.rotation.x = -Math.PI / 2 // Z-up -> Y-up
  wrap.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(wrap)
  if (box.isEmpty()) throw new Error('geometría vacía')
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  wrap.position.sub(center)

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const fov = (camera.fov * Math.PI) / 180
  const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.9
  camera.position.set(dist * 0.82, dist * 0.62, dist * 1.0)
  camera.near = Math.max(dist / 100, 0.01)
  camera.far = dist * 12
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()

  const scene = buildScene()
  scene.add(wrap)
  renderer.render(scene, camera)
}

function parseStl(buffer: ArrayBuffer): THREE.Object3D {
  const geometry = new STLLoader().parse(buffer)
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, stlMaterial)
}

function parseObj(buffer: ArrayBuffer): THREE.Object3D {
  const text = new TextDecoder().decode(buffer)
  const object = new OBJLoader().parse(text)
  object.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals()
    m.material = stlMaterial
  })
  return object
}

function parse3mf(buffer: ArrayBuffer): THREE.Object3D {
  const object = new ThreeMFLoader().parse(buffer)
  object.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals()
    const first = Array.isArray(m.material) ? m.material[0] : m.material
    const hasRealColor =
      !!m.geometry.attributes.color ||
      !!(first as THREE.MeshStandardMaterial)?.map ||
      Array.isArray(m.material)
    if (hasRealColor) {
      ;(Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
        if (mat) mat.side = THREE.DoubleSide
      })
    } else {
      m.material = stlMaterial
    }
  })
  return object
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry?.dispose()
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    mats.forEach((x) => {
      if (x && x !== stlMaterial) x.dispose()
    })
  })
}

function handle(job: ThumbJob): void {
  let object: THREE.Object3D | null = null
  try {
    if (job.size > MAX_BYTES) {
      window.thumber.fail(job.id, 'archivo demasiado grande')
      return
    }
    object =
      job.format === 'stl'
        ? parseStl(job.buffer)
        : job.format === 'obj'
          ? parseObj(job.buffer)
          : parse3mf(job.buffer)
    const meta = meshStats(object)
    frameAndRender(object)

    const dataUrl = renderer.domElement.toDataURL('image/png')
    window.thumber.done(job.id, dataUrl.slice(dataUrl.indexOf(',') + 1), meta)
  } catch (err) {
    window.thumber.fail(job.id, err instanceof Error ? err.message : String(err))
  } finally {
    if (object) disposeTree(object)
  }
}

window.thumber.onJob(handle)
window.thumber.ready()
