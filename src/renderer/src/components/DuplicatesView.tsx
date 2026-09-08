import { useCallback, useEffect, useState } from 'react'
import type { DuplicateGroup } from '@shared/types'
import { formatBytes, formatCount, relativeTime } from '../lib/format'
import { toast } from '../lib/toast'
import { TrashIcon } from './icons'

function groupThumb(g: DuplicateGroup): string | null {
  if (!g.thumbFile) return null
  return g.thumbFile.startsWith('data:') ? g.thumbFile : `thumb://img/${g.thumbFile}`
}

export function DuplicatesView() {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [keep, setKeep] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const g = await window.api.listDuplicateGroups()
    setGroups(g)
    setKeep((prev) => {
      const next = { ...prev }
      for (const grp of g) if (next[grp.hash] == null) next[grp.hash] = grp.members[0].id
      return next
    })
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.api.onLibraryChanged(() => void refresh())
    return off
  }, [refresh])

  const clean = async (g: DuplicateGroup): Promise<void> => {
    const keepId = keep[g.hash] ?? g.members[0].id
    const toTrash = g.members.filter((m) => m.id !== keepId).map((m) => m.id)
    if (toTrash.length === 0) return
    setBusy(g.hash)
    try {
      const n = await window.api.trashFiles(toTrash)
      if (n > 0) toast(`${n} ${n === 1 ? 'copia movida' : 'copias movidas'} a la papelera`, 'danger')
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  if (groups == null) return <div className="list-empty">Cargando duplicados…</div>
  if (groups.length === 0)
    return (
      <div className="list-empty">
        <div>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
          No hay archivos duplicados. Tu biblioteca está limpia.
        </div>
      </div>
    )

  const totalWasted = groups.reduce((s, g) => s + g.wasted, 0)

  return (
    <div className="dupes">
      <div className="dupes-head">
        <b>{formatCount(groups.length)}</b> grupos de duplicados ·{' '}
        <b>{formatBytes(totalWasted)}</b> recuperables
      </div>

      <div className="dupes-list">
        {groups.map((g, i) => {
          const keepId = keep[g.hash] ?? g.members[0].id
          const thumb = groupThumb(g)
          return (
            <div className="dupe-group" key={g.hash} style={{ '--i': i } as React.CSSProperties}>
              <div className="dupe-thumb">
                {thumb ? <img src={thumb} alt="" /> : <span className="ph-glyph">△</span>}
              </div>
              <div className="dupe-main">
                <div className="dupe-meta">
                  {g.members.length} copias · {formatBytes(g.size)} c/u ·{' '}
                  <span className="dupe-waste">{formatBytes(g.wasted)} de más</span>
                </div>
                <div className="dupe-members">
                  {g.members.map((m) => (
                    <label className="dupe-member" key={m.id} title={m.path}>
                      <input
                        type="radio"
                        name={g.hash}
                        checked={m.id === keepId}
                        onChange={() => setKeep((k) => ({ ...k, [g.hash]: m.id }))}
                      />
                      <span className="dm-lib">{m.rootLabel}</span>
                      <span className="dm-path">{m.relPath}</span>
                      <span className="dm-date">{relativeTime(m.mtimeMs)}</span>
                    </label>
                  ))}
                </div>
                <button
                  className="btn sm"
                  disabled={busy === g.hash}
                  onClick={() => clean(g)}
                >
                  <TrashIcon size={13} plain />
                  {busy === g.hash
                    ? 'Moviendo…'
                    : g.members.length - 1 === 1
                      ? 'Mover la otra copia a la papelera'
                      : `Mover las otras ${g.members.length - 1} a la papelera`}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
