// Genera build/icon.png (512×512): marca de Layer Library (extrusor + capas)
// sobre degradado naranja con esquinas redondeadas. Derivada del logo R3D.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const S = 512
// RGBA float buffer
const px = new Float64Array(S * S * 4)

function set(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= S || y >= S) return
  const i = (y * S + x) * 4
  const ia = a + px[i + 3] * (1 - a)
  if (ia <= 0) return
  px[i] = (r * a + px[i] * px[i + 3] * (1 - a)) / ia
  px[i + 1] = (g * a + px[i + 1] * px[i + 3] * (1 - a)) / ia
  px[i + 2] = (b * a + px[i + 2] * px[i + 3] * (1 - a)) / ia
  px[i + 3] = ia
}

// supersampled coverage helper
function cover(x, y, fn) {
  let c = 0
  for (let sy = 0; sy < 3; sy++)
    for (let sx = 0; sx < 3; sx++) if (fn(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) c++
  return c / 9
}

const R = 96 // corner radius
function inRound(x, y) {
  const rx = Math.min(x, S - x)
  const ry = Math.min(y, S - y)
  if (rx >= R && ry >= R) return true
  if (rx >= R || ry >= R) return rx >= 0 && ry >= 0
  return (rx - R) ** 2 + (ry - R) ** 2 <= R * R
}

function roundRect(x0, y0, w, h, rad) {
  return (x, y) => {
    const cx = Math.min(Math.max(x, x0 + rad), x0 + w - rad)
    const cy = Math.min(Math.max(y, y0 + rad), y0 + h - rad)
    if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad || (x >= x0 + rad && x <= x0 + w - rad) || (y >= y0 + rad && y <= y0 + h - rad)
  }
}

function poly(pts) {
  return (x, y) => {
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]
      const [xj, yj] = pts[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
}

function thickLine(ax, ay, bx, by, wd) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  return (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (len * len)))
    const px2 = ax + t * dx
    const py2 = ay + t * dy
    return (x - px2) ** 2 + (y - py2) ** 2 <= (wd / 2) ** 2
  }
}

// --- pintar fondo (degradado naranja diagonal) ------------------
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const cov = cover(x, y, inRound)
    if (cov <= 0) continue
    const t = (x + y) / (2 * S)
    const r = 255
    const g = Math.round(122 * (1 - t) + 176 * t)
    const b = Math.round(47 * (1 - t) + 102 * t)
    set(x, y, r, g, b, cov)
  }
}

// --- marca (color oscuro) --------------------------------------
const INK = [26, 18, 6]
const K = 14
const OX = 88
const OY = 84
const map = (x, y) => [OX + x * K, OY + y * K]

const shapes = [
  { fn: poly([map(8.5, 3.5), map(15.5, 3.5), map(13.4, 8.35), map(10.6, 8.35)]), a: 1 },
  { fn: thickLine(...map(12, 8.4), ...map(11, 11.1), 1.7 * K), a: 1 },
  { fn: roundRect(...map(8, 11.6), 8 * K, 2.9 * K, 1.45 * K), a: 0.5 },
  { fn: roundRect(...map(5.8, 15.2), 12.4 * K, 3 * K, 1.5 * K), a: 0.78 },
  { fn: roundRect(...map(4, 18.9), 16 * K, 3.1 * K, 1.55 * K), a: 1 }
]

for (let y = OY - 4; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (!inRound(x, y)) continue
    for (const sh of shapes) {
      const c = cover(x, y, sh.fn)
      if (c > 0) set(x, y, INK[0], INK[1], INK[2], c * sh.a)
    }
  }
}

// --- codificar PNG -------------------------------------------
const raw = Buffer.alloc((S * 4 + 1) * S)
let p = 0
for (let y = 0; y < S; y++) {
  raw[p++] = 0
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    raw[p++] = Math.round(px[i])
    raw[p++] = Math.round(px[i + 1])
    raw[p++] = Math.round(px[i + 2])
    raw[p++] = Math.round(px[i + 3] * 255)
  }
}
function crc32(b) {
  let c = ~0
  for (let i = 0; i < b.length; i++) {
    c ^= b[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c
}
function chunk(type, data) {
  const o = Buffer.alloc(12 + data.length)
  o.writeUInt32BE(data.length, 0)
  o.write(type, 4)
  data.copy(o, 8)
  o.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])) >>> 0, 8 + data.length)
  return o
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8
ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
const dir = path.join(__dirname, '..', 'build')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'icon.png'), png)
console.log('build/icon.png', png.length, 'bytes')
