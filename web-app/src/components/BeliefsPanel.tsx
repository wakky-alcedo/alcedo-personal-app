import React, { useEffect, useMemo, useState } from 'react'
import { createBelief, deleteBelief, getBeliefs, updateBelief, type Belief } from '../api.ts'

type Props = {
  serverUrl: string
  apiKey: string
}

function BeliefRow({ belief, onSave, onDelete }: { belief: Belief; onSave: (belief: Belief) => Promise<void>; onDelete: (belief: Belief) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState(belief.text)
  const [isActive, setIsActive] = useState(belief.isActive)

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
    <li className={`belief-row${belief.isActive ? '' : ' inactive'}`}>
      {!editing ? (
        <>
          <div>
            <button type="button" className="link-button task-node-title" onClick={() => setEditing(true)}>{belief.text}</button>
            <div className="meta">{belief.id} • {belief.isActive ? 'active' : 'inactive'}</div>
          </div>
          <div className="actions">
            <button type="button" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
            <button type="button" onClick={remove} disabled={busy}>Delete</button>
          </div>
        </>
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

export default function BeliefsPanel({ serverUrl, apiKey }: Props) {
  const [beliefs, setBeliefs] = useState<Belief[]>([])
  const [loading, setLoading] = useState(false)
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

  const featured = useMemo(() => beliefs.find(belief => belief.id === featuredId) ?? beliefs.find(belief => belief.isActive) ?? null, [beliefs, featuredId])

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
    </section>
  )
}