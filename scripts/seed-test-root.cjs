// Utilidad de desarrollo: inserta la carpeta de fixtures como raíz y limpia files.
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const dbPath = path.join(process.env.APPDATA, 'layer-library', 'library.db')
const fixture = path.join(__dirname, '..', 'test-fixtures', 'lib')

const db = new DatabaseSync(dbPath)
db.prepare('DELETE FROM files').run()
db.prepare('DELETE FROM roots').run()
db.prepare('INSERT INTO roots (path,label,kind,added_at) VALUES (?,?,?,?)').run(
  fixture,
  'Test Lib',
  'local',
  Date.now()
)
console.log('root =', JSON.stringify(db.prepare('SELECT * FROM roots').all()))
