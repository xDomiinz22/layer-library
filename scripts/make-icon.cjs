// Genera build/icon.png (512) y build/icon.ico (256): marca de Layer Library
// (extrusor + pila de capas) sobre degradado naranja redondeado. Deriva del logo R3D.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

function render(S) {
  const px = new Float64Array(S * S * 4)
  const scale = S / 512

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
  function cover(x, y, fn) {
    let c = 0
    for (let sy = 0; sy < 3; sy++)
      for (let sx = 0; sx < 3; sx++) if (fn(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) c++
    return c / 9
  }

  const R = 96 * scale
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
      return (
        (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad ||
        (x >= x0 + rad && x <= x0 + w - rad) ||
        (y >= y0 + rad && y <= y0 + h - rad)
      )
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
      const p2x = ax + t * dx
      const p2y = ay + t * dy
      return (x - p2x) ** 2 + (y - p2y) ** 2 <= (wd / 2) ** 2
    }
  }

  // fondo naranja
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cov = cover(x, y, inRound)
      if (cov <= 0) continue
      const t = (x + y) / (2 * S)
      set(x, y, 255, Math.round(122 * (1 - t) + 176 * t), Math.round(47 * (1 - t) + 102 * t), cov)
    }
  }

  // marca
  const INK = [26, 18, 6]
  const K = 14 * scale
  const OX = 88 * scale
  const OY = 84 * scale
  const m = (x, y) => [OX + x * K, OY + y * K]
  const shapes = [
    { fn: poly([m(8.5, 3.5), m(15.5, 3.5), m(13.4, 8.35), m(10.6, 8.35)]), a: 1 },
    { fn: thickLine(...m(12, 8.4), ...m(11, 11.1), 1.7 * K), a: 1 },
    { fn: roundRect(...m(8, 11.6), 8 * K, 2.9 * K, 1.45 * K), a: 0.5 },
    { fn: roundRect(...m(5.8, 15.2), 12.4 * K, 3 * K, 1.5 * K), a: 0.78 },
    { fn: roundRect(...m(4, 18.9), 16 * K, 3.1 * K, 1.55 * K), a: 1 }
  ]
  for (let y = Math.floor(OY - 4 * scale); y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inRound(x, y)) continue
      for (const sh of shapes) {
        const c = cover(x, y, sh.fn)
        if (c > 0) set(x, y, INK[0], INK[1], INK[2], c * sh.a)
      }
    }
  }

  // PNG
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
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
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

/** ICO con varias entradas PNG (Vista+). */
function ico(sizes) {
  const entries = sizes.map((s) => ({ s, png: render(s) }))
  const head = Buffer.alloc(6 + 16 * entries.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(entries.length, 4)
  let offset = head.length
  entries.forEach((e, idx) => {
    const o = 6 + idx * 16
    head.writeUInt8(e.s >= 256 ? 0 : e.s, o)
    head.writeUInt8(e.s >= 256 ? 0 : e.s, o + 1)
    head.writeUInt8(0, o + 2)
    head.writeUInt8(0, o + 3)
    head.writeUInt16LE(1, o + 4)
    head.writeUInt16LE(32, o + 6)
    head.writeUInt32LE(e.png.length, o + 8)
    head.writeUInt32LE(offset, o + 12)
    offset += e.png.length
  })
  return Buffer.concat([head, ...entries.map((e) => e.png)])
}

const dir = path.join(__dirname, '..', 'build')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'icon.png'), render(512))
fs.writeFileSync(path.join(dir, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]))
console.log('build/icon.png + build/icon.ico')
