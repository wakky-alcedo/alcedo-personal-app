// Controls shared by the root task row and its subtask nodes in TaskRow.
import React from 'react'
import type { TaskNode } from '../../api.ts'
import DescriptionContent from './DescriptionContent.tsx'

type Priority = NonNullable<TaskNode['priority']>

/** Opens the native picker on click (Chromium); harmless where unsupported. */
export function showPicker(e: React.MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
  el.showPicker?.()
}

/** `<input type="date">` value → stored dueAt (UTC midnight), or null when cleared. */
export function dateInputToDueAt(value: string): string | null {
  return value ? `${value}T00:00:00.000Z` : null
}

export function PrioritySelect({ value, onChange, ariaLabel }: {
  value: Priority
  onChange: (priority: Priority) => void
  ariaLabel: string
}) {
  return (
    <label className="priority-select">
      <select value={value} onChange={e => onChange(e.target.value as Priority)} aria-label={ariaLabel}>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
    </label>
  )
}

/** Description textarea while editing, linkified text otherwise; nothing when there is no description. */
export function DescriptionField({ description, editing, onChange, onCommit, onCancel, onBeginEdit, ariaLabel }: {
  description: string | null | undefined
  editing: boolean
  onChange: (text: string) => void
  onCommit: () => void
  onCancel: () => void
  onBeginEdit: () => void
  ariaLabel: string
}) {
  if (description == null) return null
  if (!editing) return <DescriptionContent text={description} onEdit={onBeginEdit} />
  return (
    <textarea
      className="task-node-description task-node-description-row"
      autoFocus
      value={description}
      onChange={e => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onCommit() }
      }}
      aria-label={ariaLabel}
    />
  )
}

export function NodeActionsMenu({ label, hasDescription, busy, onAddChild, onEditDescription, onDelete }: {
  label: string
  hasDescription: boolean
  busy: boolean
  onAddChild: () => void
  onEditDescription: () => void
  onDelete: () => void
}) {
  return (
    <div className="task-node-menu" role="menu" aria-label={`Actions for ${label}`}>
      <button type="button" role="menuitem" onClick={onAddChild} disabled={busy}>Add Child</button>
      <button type="button" role="menuitem" onClick={onEditDescription} disabled={busy}>
        {hasDescription ? 'Edit Description' : 'Add Description'}
      </button>
      <button type="button" role="menuitem" onClick={onDelete} disabled={busy}>Delete</button>
    </div>
  )
}

type DragPayload = { parent: number[]; index: number }

export function writeDragPayload(e: React.DragEvent, payload: DragPayload) {
  try {
    e.dataTransfer.setData('text/plain', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  } catch { /* some browsers restrict dataTransfer outside dragstart */ }
}

/** Returns the dragged node's position, or null for foreign/malformed drops. */
export function readDragPayload(e: React.DragEvent): DragPayload | null {
  try {
    const data: unknown = JSON.parse(e.dataTransfer.getData('text/plain'))
    if (!data || typeof data !== 'object') return null
    const { parent, index } = data as Record<string, unknown>
    if (typeof index !== 'number') return null
    return { parent: Array.isArray(parent) ? parent.filter((n): n is number => typeof n === 'number') : [], index }
  } catch {
    return null
  }
}

export function samePath(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i])
}
