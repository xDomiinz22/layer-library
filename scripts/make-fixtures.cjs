// Genera fixtures VÁLIDOS para probar el render de miniaturas.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const { zipSync, strToU8 } = require('fflate')

const dir = path.join(__dirname, '..', 'test-fixtures', 'render')
fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(path.join(dir, 'sub'), { recursive: true })

// --- STL binario válido: cubo -----------------------------------------
function cubeStl() {
  const v = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1]
  ]
  const faces = [
    [0, 1, 2],
    [0, 2, 3],
    [4, 6, 5],
    [4, 7, 6],
    [0, 4, 5],
    [0, 5, 1],
    [1, 5, 6],
    [1, 6, 2],
    [2, 6, 7],
    [2, 7, 3],
    [3, 7, 4],
    [3, 4, 0]
  ]
  const buf = Buffer.alloc(84 + 50 * faces.length)
  buf.write('cube binary stl fixture', 0)
  buf.writeUInt32LE(faces.length, 80)
  let o = 84
  for (const f of faces) {
    o += 12 // normal 0,0,0 -> loader recomputa
    for (const idx of f) {
      buf.writeFloatLE(v[idx][0], o)
      buf.writeFloatLE(v[idx][1], o + 4)
      buf.writeFloatLE(v[idx][2], o + 8)
      o += 12
    }
    o += 2
  }
  return buf
}

// --- PNG real (degradado NxN) ----------------------------------------
function makePng(n = 48) {
  const raw = Buffer.alloc((n * 3 + 1) * n)
  let p = 0
  for (let y = 0; y < n; y++) {
    raw[p++] = 0
    for (let x = 0; x < n; x++) {
      raw[p++] = (x / n) * 255
      raw[p++] = (y / n) * 255
      raw[p++] = 160
    }
  }
  const idat = zlib.deflateSync(raw)
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length)
    b.writeUInt32BE(data.length, 0)
    b.write(type, 4)
    data.copy(b, 8)
    const crc = crc32(Buffer.concat([Buffer.from(type), data]))
    b.writeUInt32BE(crc >>> 0, 8 + data.length)
    return b
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(n, 0)
  ihdr.writeUInt32BE(n, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c
}

// --- 3MF (zip OPC con malla tetraédrica) ----------------------------
const MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
  <object id="1" type="model">
   <mesh>
    <vertices>
     <vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/>
     <vertex x="5" y="10" z="0"/><vertex x="5" y="5" z="12"/>
    </vertices>
    <triangles>
     <triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="1" v3="3"/>
     <triangle v1="1" v2="2" v3="3"/><triangle v1="0" v2="2" v3="3"/>
    </triangles>
   </mesh>
  </object>
 </resources>
 <build><item objectid="1"/></build>
</model>`
const CT = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
</Types>`
const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

function make3mf(withThumb) {
  const files = {
    '[Content_Types].xml': strToU8(CT),
    '_rels/.rels': strToU8(RELS),
    '3D/3dmodel.model': strToU8(MODEL)
  }
  if (withThumb) files['Metadata/plate_1.png'] = new Uint8Array(makePng(64))
  return Buffer.from(zipSync(files))
}

fs.writeFileSync(path.join(dir, 'cube.stl'), cubeStl())
fs.writeFileSync(path.join(dir, 'sub', 'pyramid_with_preview.3mf'), make3mf(true))
fs.writeFileSync(path.join(dir, 'sub', 'pyramid_no_preview.3mf'), make3mf(false))
console.log('render fixtures ->', dir)
for (const f of fs.readdirSync(dir, { recursive: true })) console.log('  ', f)
