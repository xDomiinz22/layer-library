// Genera build/icon.png (512x512): marca "L" sobre degradado naranja.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const S = 512
const buf = Buffer.alloc((S * 4 + 1) * S)

function crc32(b) {
  let c = ~0
  for (let i = 0; i < b.length; i++) {
    c ^= b[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4)
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])) >>> 0, 8 + data.length)
  return out
}

// rounded-rect background + a blocky "L"
const r = 96
function inRound(x, y) {
  const rx = Math.min(x, S - 1 - x)
  const ry = Math.min(y, S - 1 - y)
  if (rx >= r || ry >= r) return true
  return (rx - r) ** 2 + (ry - r) ** 2 <= r * r
}

for (let y = 0; y < S; y++) {
  let p = y * (S * 4 + 1)
  buf[p++] = 0
  for (let x = 0; x < S; x++) {
    const t = (x + y) / (2 * S)
    let R = Math.round(255 * (1 - t) + 255 * t)
    let G = Math.round(122 * (1 - t) + 176 * t)
    let B = Math.round(47 * (1 - t) + 102 * t)
    let A = 255
    if (!inRound(x, y)) {
      A = 0
    } else {
      // "L" glyph
      const inV = x >= 168 && x <= 228 && y >= 132 && y <= 380
      const inH = y >= 320 && y <= 380 && x >= 168 && x <= 356
      if (inV || inH) {
        R = 26
        G = 18
        B = 6
      }
    }
    buf[p++] = R
    buf[p++] = G
    buf[p++] = B
    buf[p++] = A
  }
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8
ihdr[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(buf, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const dir = path.join(__dirname, '..', 'build')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'icon.png'), png)
console.log('build/icon.png', png.length, 'bytes')
