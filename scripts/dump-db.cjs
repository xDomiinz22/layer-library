const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const db = new DatabaseSync(path.join(process.env.APPDATA, 'layer-library', 'library.db'))

console.log('ROOTS:')
for (const r of db.prepare('SELECT id,label,path,last_scan_at FROM roots').all()) {
  console.log(' ', r.id, r.label, '| scanned:', r.last_scan_at ? 'yes' : 'no')
}

const files = db.prepare('SELECT rel_path,format,size,hash FROM files ORDER BY rel_path').all()
console.log(`\nFILES (${files.length}):`)
for (const f of files) {
  console.log(
    ' ',
    f.rel_path.padEnd(34),
    f.format.padEnd(4),
    String(f.size).padStart(7),
    f.hash ? f.hash.slice(0, 12) : '(no hash)'
  )
}

const dups = db
  .prepare(
    `SELECT hash, COUNT(*) c, GROUP_CONCAT(rel_path, ' = ') paths
     FROM files WHERE hash IS NOT NULL GROUP BY hash HAVING COUNT(*)>1`
  )
  .all()
console.log(`\nDUPLICATE GROUPS (${dups.length}):`)
for (const d of dups) console.log('  ', d.paths)

const fts = db
  .prepare(
    `SELECT f.rel_path FROM files_fts JOIN files f ON f.id = files_fts.rowid
     WHERE files_fts MATCH ? ORDER BY rank`
  )
  .all('"dragon"*')
console.log('\nFTS search "dragon"* ->', fts.map((r) => r.rel_path))
