// Utilidad de desarrollo: inserta una carpeta como raíz y limpia files.
// Uso: node scripts/seed-test-root.cjs [ruta]  (por defecto test-fixtures/render)
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const dbPath = path.join(process.env.APPDATA, 'layer-library', 'library.db')
const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'test-fixtures', 'render')

const db = new DatabaseSync(dbPath)
db.prepare('DELETE FROM files').run()
db.prepare('DELETE FROM roots').run()
db.prepare('INSERT INTO roots (path,label,kind,added_at) VALUES (?,?,?,?)').run(
  target,
  path.basename(target),
  'local',
  Date.now()
)
console.log('root =', JSON.stringify(db.prepare('SELECT * FROM roots').all()))
