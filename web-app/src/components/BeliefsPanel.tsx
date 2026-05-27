import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createBelief, deleteBelief, getBeliefs, updateBelief, type Belief } from '../api.ts'

type Props = {
  serverUrl: string
  apiKey: string
  compact?: boolean
}

function BeliefRow({ belief, onSave, onDelete }: {
  belief: Belief
  onSave: (belief: Belief) => Promise<void>
  onDelete: (belief: Belief) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [text, setText] = useState(belief.text)
  const [isActive, setIsActive] = useState(belief.isActive)
  const rowRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(e: PointerEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [menuOpen])

  async function save() {
    setBusy(true)
    try {
      await onSave({ ...belief, text: text.trim(), isActive })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete belief: ${belief.text}?`)) return
    setBusy(true)
    try {
      await onDelete(belief)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li ref={rowRef} className={`belief-row${belief.isActive ? '' : ' inactive'}`}>
      {!editing ? (
        <div className="task-node-body">
          <div className="task-node-head">
            <button type="button" className="link-button task-node-title belief-text" onClick={() => setEditing(true)}>
              {belief.text}
            </button>
            <button
              type="button"
              className="task-node-menu-button"
              onClick={() => setMenuOpen(v => !v)}
              disabled={busy}
              aria-label="Actions for belief"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
          </div>
          {menuOpen && (
            <div className="task-node-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setEditing(true) }} disabled={busy}>
                Edit
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void remove() }} disabled={busy}>
                Delete
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="belief-editor">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} />
          <label className="checkbox-row">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            active
          </label>
          <div className="actions">
            <button type="button" onClick={save} disabled={busy}>Save</button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function BeliefsPanel({ serverUrl, apiKey, compact = false }: Props) {
  const [beliefs, setBeliefs] = useState<Belief[]>([])
  const [loading, setLoading] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [text, setText] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [featuredId, setFeaturedId] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const nextBeliefs = await getBeliefs(serverUrl, apiKey)
      setBeliefs(nextBeliefs)
      const active = nextBeliefs.filter(belief => belief.isActive)
      setFeaturedId(active.length > 0 ? active[Math.floor(Math.random() * active.length)]!.id : null)
    } catch (error) {
      console.error(error)
      setBeliefs([])
      setFeaturedId(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [serverUrl, apiKey])

  const featured = useMemo(
    () => beliefs.find(b => b.id === featuredId) ?? beliefs.find(b => b.isActive) ?? null,
    [beliefs, featuredId]
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await createBelief(serverUrl, apiKey, { text: text.trim(), isActive })
    setText('')
    setIsActive(true)
    await refresh()
  }

  async function handleSave(belief: Belief) {
    await updateBelief(serverUrl, apiKey, belief)
    await refresh()
  }

  async function handleDelete(belief: Belief) {
    await deleteBelief(serverUrl, apiKey, belief)
    await refresh()
  }

  if (compact) {
    return (
      <section className="beliefs-panel beliefs-panel--compact">
        <div className="section-header">
          <h2>Featured belief</h2>
          <button type="button" className="compact-panel-btn" onClick={refresh} disabled={loading} title="Randomize">↺</button>
        </div>
        <p className="compact-belief-text">{featured ? featured.text : '—'}</p>
      </section>
    )
  }

  return (
    <section className="beliefs-panel">
      <div className="section-header">
        <h2>Beliefs</h2>
        <button type="button" onClick={refresh} disabled={loading}>Randomize</button>
      </div>

      <div className="featured-card">
        <div className="featured-label">Featured belief</div>
        <div className="featured-text">{featured ? featured.text : 'No active belief yet'}</div>
      </div>

      <button
        type="button"
        className="collapse-toggle"
        onClick={() => setListOpen(v => !v)}
      >
        {listOpen ? '▾' : '▸'} All beliefs ({beliefs.length})
      </button>

      {listOpen && (
        <>
          <form className="belief-form" onSubmit={handleCreate}>
            <textarea placeholder="Write a belief..." value={text} onChange={e => setText(e.target.value)} rows={3} />
            <label className="checkbox-row">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              active
            </label>
            <button type="submit" disabled={loading}>Add Belief</button>
          </form>

          {loading ? <div>Loading...</div> : null}
          <ul className="belief-list">
            {beliefs.map(belief => (
              <BeliefRow key={belief.id} belief={belief} onSave={handleSave} onDelete={handleDelete} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
