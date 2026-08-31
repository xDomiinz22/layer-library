/**
 * Renderizador de miniaturas. Corre en una ventana oculta de Electron.
 * Recibe archivos STL/3MF del proceso principal, los rinde con Three.js
 * y devuelve un PNG en base64.
 */
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import type { ThumbJob, ThumberBridge } from '@shared/thumb'

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

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10000)

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

function frame(object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) throw new Error('geometría vacía')
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  object.position.sub(center)

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const fov = (camera.fov * Math.PI) / 180
  const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.9

  camera.position.set(dist * 0.82, dist * 0.62, dist * 1.0)
  camera.near = dist / 100
  camera.far = dist * 12
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
}

const stlMaterial = new THREE.MeshStandardMaterial({
  color: 0xc4c8d0,
  roughness: 0.72,
  metalness: 0.04,
  flatShading: true,
  side: THREE.DoubleSide
})

function renderStl(buffer: ArrayBuffer): void {
  const geometry = new STLLoader().parse(buffer)
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, stlMaterial)
  const group = new THREE.Group()
  group.add(mesh)
  group.rotation.x = -Math.PI / 2 // STL suele ser Z-up
  group.updateMatrixWorld(true)

  const scene = buildScene()
  scene.add(group)
  frame(group)
  renderer.render(scene, camera)
  geometry.dispose()
}

function render3mf(buffer: ArrayBuffer): void {
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
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach((mat) => {
        if (mat) mat.side = THREE.DoubleSide
      })
    } else {
      m.material = stlMaterial
    }
  })
  const group = new THREE.Group()
  group.add(object)
  group.rotation.x = -Math.PI / 2
  group.updateMatrixWorld(true)

  const scene = buildScene()
  scene.add(group)
  frame(group)
  renderer.render(scene, camera)

  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.geometry?.dispose()
      const mat = m.material
      const list = Array.isArray(mat) ? mat : [mat]
      list.forEach((x) => {
        if (x && x !== stlMaterial) x.dispose()
      })
    }
  })
}

function handle(job: ThumbJob): void {
  try {
    if (job.size > MAX_BYTES) {
      window.thumber.fail(job.id, 'archivo demasiado grande')
      return
    }
    if (job.format === 'stl') renderStl(job.buffer)
    else render3mf(job.buffer)

    const dataUrl = renderer.domElement.toDataURL('image/png')
    window.thumber.done(job.id, dataUrl.slice(dataUrl.indexOf(',') + 1))
  } catch (err) {
    window.thumber.fail(job.id, err instanceof Error ? err.message : String(err))
  }
}

window.thumber.onJob(handle)
window.thumber.ready()
