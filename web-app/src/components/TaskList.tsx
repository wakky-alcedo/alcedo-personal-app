import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Task, TaskNode } from '../api.ts'
import TaskSubtasksEditor from './TaskSubtasksEditor.tsx'

type Props = {
  tasks: Task[]
  onDone: (task: Task) => Promise<void>
  onSave: (task: Task) => Promise<void>
  onDelete: (task: Task) => Promise<void>
}

function createTaskNode(title = ''): TaskNode {
  return {
    id: crypto.randomUUID(),
    title,
    done: false,
    subtasks: [],
  }
}

function cloneTaskNode(node: TaskNode): TaskNode {
  return {
    ...node,
    subtasks: node.subtasks.map(cloneTaskNode),
  }
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    subtasks: task.subtasks.map(cloneTaskNode),
  }
}

function updateTaskTree(nodes: TaskNode[], path: number[], updater: (node: TaskNode) => TaskNode): TaskNode[] {
  if (path.length === 0) return nodes
  const [index, ...rest] = path
  return nodes.map((node, nodeIndex) => {
    if (nodeIndex !== index) return node
    if (rest.length === 0) return updater(node)
    return {
      ...node,
      subtasks: updateTaskTree(node.subtasks, rest, updater),
    }
  })
}

function removeTaskTreeNode(nodes: TaskNode[], path: number[]): TaskNode[] {
  if (path.length === 0) return nodes
  const [index, ...rest] = path
  if (rest.length === 0) {
    return nodes.filter((_, nodeIndex) => nodeIndex !== index)
  }
  return nodes.map((node, nodeIndex) => {
    if (nodeIndex !== index) return node
    return {
      ...node,
      subtasks: removeTaskTreeNode(node.subtasks, rest),
    }
  })
}

function pathLabel(path: number[]) {
  return path.length === 0 ? 'task' : `child ${path.map(index => index + 1).join('.')}`
}

function TaskRow({ task, onDone, onSave, onDelete }: { task: Task; onDone: Props['onDone']; onSave: Props['onSave']; onDelete: Props['onDelete'] }) {
  // per-node editing path; null = none, [] = root
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(() => cloneTask(task))
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null)

  useEffect(() => {
    setDraft(cloneTask(task))
    setEditingPath(null)
    setOpenMenuPath(null)
  }, [task])

  const dueLabel = useMemo(() => (draft.dueAt ? new Date(draft.dueAt).toLocaleDateString() : 'none'), [draft.dueAt])

  function updateRootTask(nextTask: Task) {
    setDraft(cloneTask(nextTask))
  }

  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const [editingPath, setEditingPath] = useState<number[] | null>(null)
  useEffect(() => {
    if (editingPath && editingPath.length === 0) titleInputRef.current?.focus()
  }, [editingPath])

  function pathEquals(a: number[] | null, b: number[]) {
    if (!a) return false
    if (a.length !== b.length) return false
    return a.every((v, i) => v === b[i])
  }

  function getNodeAtPath(nodes: TaskNode[], path: number[]): TaskNode | null {
    let cur: TaskNode | null = null
    let arr = nodes
    for (const idx of path) {
      if (!arr || idx < 0 || idx >= arr.length) return null
      cur = arr[idx]
      arr = cur.subtasks
    }
    return cur
  }

  function updateNode(path: number[], updater: (node: TaskNode) => TaskNode) {
    setDraft(current => ({
      ...current,
      subtasks: updateTaskTree(current.subtasks, path, updater),
    }))
  }

  function addChild(path: number[]) {
    const target = path.length === 0 ? { subtasks: draft.subtasks } as any : getNodeAtPath(draft.subtasks, path)
    const newIndex = target ? target.subtasks.length : 0
    updateNode(path, node => ({
      ...node,
      subtasks: [...node.subtasks, createTaskNode()],
    }))
    // focus the newly created child row
    setEditingPath([...path, newIndex])
  }

  async function saveTask(nextTask: Task) {
    await onSave({
      ...nextTask,
      title: nextTask.title.trim(),
      description: nextTask.description?.trim() || null,
      dueAt: nextTask.dueAt ? new Date(`${nextTask.dueAt.slice(0, 10)}T00:00:00`).toISOString() : null,
    })
  }

  async function save() {
    setBusy(true)
    const prev = cloneTask(draft)
    try {
      await saveTask(draft)
      setEditingPath(null)
    } catch (err) {
      // revert on failure
      setDraft(prev)
      console.error('save failed', err)
      alert('Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete task: ${draft.title}?`)) return
    setBusy(true)
    try {
      await onDelete(draft)
    } catch (err) {
      console.error('delete failed', err)
      alert('Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleRootDone(nextDone: boolean) {
    const prev = cloneTask(draft)
    const nextTask = { ...draft, status: nextDone ? ('done' as const) : ('todo' as const) }
    // optimistic update
    updateRootTask(nextTask)
    setBusy(true)
    try {
      await saveTask(nextTask)
    } catch (err) {
      // revert on failure
      setDraft(prev)
      console.error('toggle root done failed', err)
      alert('Failed to update task status')
    } finally {
      setBusy(false)
    }
  }

  async function toggleNodeDone(path: number[], nextDone: boolean) {
    const prev = cloneTask(draft)
    const nextTask = {
      ...draft,
      subtasks: updateTaskTree(draft.subtasks, path, node => ({ ...node, done: nextDone })),
    }
    // optimistic
    updateRootTask(nextTask)
    setBusy(true)
    try {
      await saveTask(nextTask)
    } catch (err) {
      setDraft(prev)
      console.error('toggle node done failed', err)
      alert('Failed to toggle child done')
    } finally {
      setBusy(false)
    }
  }

  async function deleteNode(path: number[]) {
    if (path.length === 0) {
      await remove()
      return
    }
    const prev = cloneTask(draft)
    const nextTask = {
      ...draft,
      subtasks: removeTaskTreeNode(draft.subtasks, path),
    }
    // optimistic
    updateRootTask(nextTask)
    setBusy(true)
    try {
      await saveTask(nextTask)
      // if deleting the node that was being edited, clear editor
      if (editingPath && pathEquals(editingPath, path)) setEditingPath(null)
    } catch (err) {
      setDraft(prev)
      console.error('delete node failed', err)
      alert('Failed to delete child')
    } finally {
      setBusy(false)
    }
  }

  const editorRefs = useRef(new Map<string, HTMLDivElement | null>())

  function pathKey(path: number[] | null) {
    if (path === null) return 'none'
    if (path.length === 0) return 'root'
    return path.join('-')
  }

  function isMenuOpen(path: number[]) {
    return openMenuPath === pathKey(path)
  }

  function closeMenu() {
    setOpenMenuPath(null)
  }

  function openMenu(path: number[] | null) {
    setOpenMenuPath(pathKey(path))
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('.task-node-card')) closeMenu()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  async function commitEditing(path: number[] | null) {
    if (path === null) return
    setBusy(true)
    const prev = cloneTask(draft)
    try {
      await saveTask(draft)
      setEditingPath(null)
    } catch (err) {
      setDraft(prev)
      console.error('commit failed', err)
      alert('Save failed')
    } finally {
      setBusy(false)
    }
  }

  function cancelEditing() {
    setDraft(cloneTask(task))
    setEditingPath(null)
  }

  function renderNode(node: TaskNode, path: number[] = []): React.ReactNode {
    const nodeName = node.title || `Untitled ${pathLabel(path)}`
    const isEditingNode = pathEquals(editingPath, path)
    return (
      <li
        key={node.id}
        className={`task-node-card ${node.done ? 'done' : ''}`}
        role="listitem"
        aria-label={nodeName}
        onContextMenu={event => {
          event.preventDefault()
          openMenu(path)
        }}
      >
        <div className="task-node-body">
          <div className="task-node-head">
            <label className="checkbox-row task-node-check">
              <input type="checkbox" checked={node.done} onChange={event => void toggleNodeDone(path, event.target.checked)} disabled={busy} aria-label={`Mark ${nodeName} as done`} />
            </label>
            {!isEditingNode ? (
              <button
                type="button"
                className="link-button task-node-title"
                onClick={() => setEditingPath(path)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingPath(path) } }}
                aria-label={`${nodeName}`}
                disabled={busy}
              >
                {nodeName}
              </button>
            ) : (
              <div
                className="inline-editor"
                ref={el => editorRefs.current.set(pathKey(path), el)}
              >
                <input
                  autoFocus
                  value={node.title}
                  onChange={e => updateNode(path, n => ({ ...n, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void commitEditing(path) } if (e.key === 'Escape') { e.preventDefault(); cancelEditing() } }}
                  onBlur={() => {
                    // delay to allow focus moves within editor
                    setTimeout(() => {
                      const el = editorRefs.current.get(pathKey(path))
                      if (!el) return
                      const active = document.activeElement
                      if (!el.contains(active)) void commitEditing(path)
                    }, 0)
                  }}
                  aria-label={`Title for ${nodeName}`}
                />
                <textarea
                  value={node.description ?? ''}
                  onChange={e => updateNode(path, n => ({ ...n, description: e.target.value }))}
                  rows={2}
                  onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); cancelEditing() } }}
                  onBlur={() => {
                    setTimeout(() => {
                      const el = editorRefs.current.get(pathKey(path))
                      if (!el) return
                      const active = document.activeElement
                      if (!el.contains(active)) void commitEditing(path)
                    }, 0)
                  }}
                  aria-label={`Description for ${nodeName}`}
                />
              </div>
            )}
            <button
              type="button"
              className="task-node-menu-button"
              onClick={() => (isMenuOpen(path) ? closeMenu() : openMenu(path))}
              aria-label={`Open actions for ${nodeName}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen(path)}
              disabled={busy}
            >
              ⋯
            </button>
          </div>
          {isMenuOpen(path) ? (
            <div className="task-node-menu" role="menu" aria-label={`Actions for ${nodeName}`}>
              <button type="button" role="menuitem" onClick={() => { closeMenu(); addChild(path) }} disabled={busy}>Add Child</button>
              <button type="button" role="menuitem" onClick={() => { closeMenu(); void deleteNode(path) }} disabled={busy}>Delete</button>
            </div>
          ) : null}
        </div>
        {node.subtasks.length > 0 ? (
          <ul className="task-tree">
            {node.subtasks.map((child, childIndex) => renderNode(child, [...path, childIndex]))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <li
      className={`task-node-card ${task.status === 'done' ? 'done' : ''}`}
      role="listitem"
      aria-label={draft.title}
      onContextMenu={event => {
        event.preventDefault()
        openMenu([])
      }}
    >
      <div className="task-node-body">
        <div className="task-node-head">
          <label className="checkbox-row task-node-check">
            <input type="checkbox" checked={draft.status === 'done'} onChange={event => void toggleRootDone(event.target.checked)} disabled={busy} aria-label={`Mark ${draft.title} as done`} />
          </label>
          {!pathEquals(editingPath, []) ? (
            <button
              type="button"
              className="link-button task-node-title"
              onClick={() => setEditingPath([])}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingPath([]) } }}
              aria-label={`${draft.title}`}
              disabled={busy}
            >
              {draft.title}
            </button>
          ) : (
            <div className="inline-editor" ref={el => editorRefs.current.set(pathKey([]), el)}>
              <input
                ref={titleInputRef}
                value={draft.title}
                onChange={e => setDraft(current => ({ ...current, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void commitEditing([]) } if (e.key === 'Escape') { e.preventDefault(); cancelEditing() } }}
                onBlur={() => {
                  setTimeout(() => {
                    const el = editorRefs.current.get(pathKey([]))
                    if (!el) return
                    const active = document.activeElement
                    if (!el.contains(active)) void commitEditing([])
                  }, 0)
                }}
                aria-label="Task title"
              />
              <textarea
                value={draft.description ?? ''}
                onChange={e => setDraft(current => ({ ...current, description: e.target.value }))}
                rows={2}
                onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); cancelEditing() } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void commitEditing([]) } }}
                onBlur={() => {
                  setTimeout(() => {
                    const el = editorRefs.current.get(pathKey([]))
                    if (!el) return
                    const active = document.activeElement
                    if (!el.contains(active)) void commitEditing([])
                  }, 0)
                }}
                aria-label="Task description"
              />
            </div>
          )}
          <button
            type="button"
            className="task-node-menu-button"
            onClick={() => (isMenuOpen([]) ? closeMenu() : openMenu([]))}
            aria-label={`Open actions for ${draft.title}`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen([])}
            disabled={busy}
          >
            ⋯
          </button>
        </div>
        {isMenuOpen([]) ? (
          <div className="task-node-menu" role="menu" aria-label={`Actions for ${draft.title}`}>
            <button type="button" role="menuitem" onClick={() => { closeMenu(); addChild([]) }} disabled={busy}>Add Child</button>
            <button type="button" role="menuitem" onClick={() => { closeMenu(); remove() }} disabled={busy}>Delete</button>
          </div>
        ) : null}
        <ul className="task-tree">
          {draft.subtasks.map((node, index) => renderNode(node, [index]))}
        </ul>
      </div>
    </li>
  )
}

export default function TaskList({ tasks, onDone, onSave, onDelete }: Props) {
  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter(task => !task.deletedAt)
  if (safeTasks.length === 0) return <div>No tasks</div>
  return (
    <ul className="task-list">
      {safeTasks.map(t => (
        <TaskRow key={t.id} task={t} onDone={onDone} onSave={onSave} onDelete={onDelete} />
      ))}
    </ul>
  )
}
