import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Task, TaskNode } from '../api.ts'

const URL_RE = /(https?:\/\/[^\s]+)/g

function dueDateClass(dueAt: string | null | undefined): string {
  if (!dueAt) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueAt)
  due.setHours(0, 0, 0, 0)
  const diff = due.getTime() - today.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < 0) return 'due-overdue'
  if (days === 0) return 'due-today'
  if (days <= 3) return 'due-soon'
  if (days <= 7) return 'due-near'
  return ''
}

function DescriptionContent({ text, onEdit }: { text: string; onEdit: () => void }) {
  const parts = text.split(URL_RE)
  // split with capture group: even indices = plain text, odd indices = URLs
  return (
    <button type="button" className="task-node-description task-node-description-row" onClick={onEdit}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            className="description-url"
            onClick={e => { if (e.ctrlKey || e.metaKey) { e.stopPropagation(); window.open(part, '_blank', 'noopener noreferrer') } }}
            title="Ctrl+クリックで開く"
          >
            {part}<span className="description-url-icon" aria-label="新しいタブを開きます">↗</span>
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </button>
  )
}
type RowProps = {
  task: Task
  onSave: (t: Task) => Promise<void>
  onDelete: (t: Task) => Promise<void>
}

function TaskRow({ task, onSave, onDelete }: RowProps) {
  const [editingDescriptionPath, setEditingDescriptionPath] = useState<string | null>(null)

  function pathLabel(path: number[]) {
    return path.length === 0 ? 'root' : path.join('.')
  }

  function cloneTaskNode(n: TaskNode): TaskNode {
    return { ...n, subtasks: n.subtasks.map(cloneTaskNode) }
  }

  function createTaskNode(): TaskNode {
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: '',
      description: null,
      done: false,
      dueAt: null,
      priority: 'medium',
      parentId: null,
      subtasks: [],
    }
  }

  function cloneTask(t: Task): Task {
    return {
      ...t,
      subtasks: t.subtasks.map(cloneTaskNode),
    }
  }

  function updateTaskTree(nodes: TaskNode[], path: number[], updater: (node: TaskNode) => TaskNode): TaskNode[] {
    if (path.length === 0) throw new Error('invalid path for updateTaskTree')
    const [idx, ...rest] = path
    return nodes.map((n, i) => {
      if (i !== idx) return n
      if (rest.length === 0) return updater(n)
      return { ...n, subtasks: updateTaskTree(n.subtasks, rest, updater) }
    })
  }

  function removeTaskTreeNode(nodes: TaskNode[], path: number[]): TaskNode[] {
    if (path.length === 0) return nodes
    const [idx, ...rest] = path
    if (rest.length === 0) return nodes.filter((_, i) => i !== idx)
    return nodes.map((n, i) => (i !== idx ? n : { ...n, subtasks: removeTaskTreeNode(n.subtasks, rest) }))
  }

  const [draft, setDraft] = useState<Task>(cloneTask(task))
  const [editingPath, setEditingPath] = useState<number[] | null>(null)
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraft(cloneTask(task))
  }, [task.version])
  const dueLabel = draft.dueAt ? new Date(draft.dueAt).toLocaleDateString() : 'No due'

  function updateRootTask(next: Task) {
    setDraft(cloneTask(next))
  }

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
    if (path.length === 0) {
      // update root task fields via TaskNode shape
      setDraft(current => {
        const rootNode: TaskNode = {
          id: current.id,
          title: current.title,
          description: current.description ?? null,
          done: current.status === 'done',
          dueAt: current.dueAt ?? null,
          priority: (current as any).priority ?? 'medium',
          subtasks: current.subtasks.map(cloneTaskNode),
        }
        const next = updater(rootNode)
        return {
          ...current,
          title: next.title,
          description: next.description ?? null,
          dueAt: next.dueAt ?? null,
          // map done <-> status
          status: next.done ? 'done' : 'todo',
          // keep priority
          ...(next.priority ? { priority: next.priority } : {}),
          subtasks: next.subtasks,
        }
      })
      return
    }
    setDraft(current => ({
      ...current,
      subtasks: updateTaskTree(current.subtasks, path, updater),
    }))
  }

  function moveInArray<T>(arr: T[], from: number, to: number) {
    const copy = arr.slice()
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
  }

  function updateTaskTreeReorder(nodes: TaskNode[], path: number[], fromIndex: number, toIndex: number): TaskNode[] {
    if (path.length === 0) {
      // reorder at root subtasks
      return moveInArray(nodes, fromIndex, toIndex)
    }
    const [idx, ...rest] = path
    return nodes.map((n, i) => {
      if (i !== idx) return n
      return {
        ...n,
        subtasks: updateTaskTreeReorder(n.subtasks, rest, fromIndex, toIndex),
      }
    })
  }

  function addSiblingAfter(path: number[]) {
    const parentPath = path.slice(0, -1)
    const insertAt = path[path.length - 1] + 1
    const newNode = createTaskNode()
    if (parentPath.length === 0) {
      setDraft(current => ({
        ...current,
        subtasks: [
          ...current.subtasks.slice(0, insertAt),
          newNode,
          ...current.subtasks.slice(insertAt),
        ],
      }))
    } else {
      setDraft(current => ({
        ...current,
        subtasks: updateTaskTree(current.subtasks, parentPath, node => ({
          ...node,
          subtasks: [
            ...node.subtasks.slice(0, insertAt),
            newNode,
            ...node.subtasks.slice(insertAt),
          ],
        })),
      }))
    }
    setEditingPath([...parentPath, insertAt])
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

  async function reorderSubtasks(parentPath: number[], fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const prev = cloneTask(draft)
    const nextDraft = {
      ...draft,
      subtasks: updateTaskTreeReorder(draft.subtasks, parentPath, fromIndex, toIndex),
    }
    // optimistic
    setDraft(cloneTask(nextDraft))
    setBusy(true)
    try {
      await saveTask(nextDraft)
    } catch (err) {
      setDraft(prev)
      console.error('reorder failed', err)
      alert('Failed to reorder tasks')
    } finally {
      setBusy(false)
    }
  }

  async function saveTask(nextTask: Task) {
    await onSave({
      ...nextTask,
      title: nextTask.title.trim(),
      description: nextTask.description?.trim() || null,
      dueAt: nextTask.dueAt ? `${nextTask.dueAt.slice(0, 10)}T00:00:00.000Z` : null,
      priority: (nextTask as any).priority ?? 'medium',
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

  function stripEmptySubtasks(nodes: TaskNode[]): TaskNode[] {
    return nodes
      .filter(n => n.title.trim() !== '')
      .map(n => ({ ...n, subtasks: stripEmptySubtasks(n.subtasks) }))
  }

  async function commitNode(path: number[] | null) {
    if (path === null) return
    setBusy(true)
    const cleaned = { ...draft, subtasks: stripEmptySubtasks(draft.subtasks) }
    setDraft(cleaned)
    const prev = cloneTask(draft)
    try {
      await saveTask(cleaned)
      if (pathEquals(editingPath, path)) setEditingPath(null)
    } catch (err) {
      setDraft(prev)
      console.error('commit failed', err)
      alert('Save failed')
    } finally {
      setBusy(false)
    }
  }

  function beginDescriptionEdit(path: number[], initialValue?: string | null) {
    if (initialValue == null) {
      updateNode(path, node => ({ ...node, description: '' }))
    }
    setEditingDescriptionPath(pathKey(path))
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
    await commitNode(path)
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
        draggable={path.length > 0}
        onDragStart={e => {
          if (path.length === 0) return
          const parent = path.slice(0, -1)
          const index = path[path.length - 1]
          try {
            e.dataTransfer.setData('text/plain', JSON.stringify({ parent, index }))
            e.dataTransfer.effectAllowed = 'move'
          } catch {}
        }}
        onDragOver={e => { e.preventDefault() }}
        onDrop={e => {
          e.preventDefault()
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'))
            const fromParent: number[] = data.parent || []
            const fromIndex: number = data.index
            const toParent = path.slice(0, -1)
            const toIndex = path[path.length - 1]
            if (JSON.stringify(fromParent) === JSON.stringify(toParent)) {
              void reorderSubtasks(toParent, fromIndex, toIndex)
            }
          } catch (err) {
            // ignore
          }
        }}
        className={`task-node-card ${node.done ? 'done' : ''} ${dueDateClass(node.dueAt)}`}
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
              <input type="checkbox" checked={node.done} onChange={event => void (path.length === 0 ? toggleRootDone(event.target.checked) : toggleNodeDone(path, event.target.checked))} disabled={busy} aria-label={`Mark ${nodeName} as done`} />
            </label>
            <div className="task-node-main">
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
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSiblingAfter(path) } if (e.key === 'Tab') { e.preventDefault(); addChild(path) } if (e.key === 'Escape') { e.preventDefault(); cancelEditing() } }}
                    onBlur={() => {
                      setTimeout(() => {
                        const el = editorRefs.current.get(pathKey(path))
                        if (!el) return
                        const active = document.activeElement
                        if (!el.contains(active)) void commitEditing(path)
                      }, 0)
                    }}
                    aria-label={`Title for ${nodeName}`}
                  />
                </div>
              )}
              <label className="priority-select">
                <select
                  value={node.priority ?? 'medium'}
                  onChange={e => {
                    const nextTask = {
                      ...draft,
                      subtasks: updateTaskTree(draft.subtasks, path, n => ({ ...n, priority: e.target.value as any })),
                    }
                    setDraft(cloneTask(nextTask))
                    void saveTask(nextTask)
                  }}
                  aria-label={`Priority for ${nodeName}`}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
            </div>
              <div className="task-due">
                <input
                  type="date"
                  value={node.dueAt ? node.dueAt.slice(0, 10) : ''}
                  onClick={e => {
                    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
                    el.showPicker?.()
                  }}
                  onChange={e => {
                        const nextTask = {
                          ...draft,
                          subtasks: updateTaskTree(draft.subtasks, path, n => ({
                            ...n,
                            dueAt: e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
                          })),
                        }
                        setDraft(cloneTask(nextTask))
                        void saveTask(nextTask)
                  }}
                  aria-label={`Due date: ${node.dueAt ? new Date(node.dueAt).toLocaleDateString() : 'No due'}`}
                />
              </div>
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
          {node.description != null ? (
            editingDescriptionPath === pathKey(path) ? (
              <textarea
                className="task-node-description task-node-description-row"
                autoFocus
                value={node.description}
                onChange={e => updateNode(path, n => ({ ...n, description: e.target.value }))}
                onBlur={() => void commitNode(path)}
                onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditingDescriptionPath(null) } if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void commitNode(path) } }}
                aria-label={`Description for ${nodeName}`}
              />
            ) : (
              <DescriptionContent text={node.description ?? ''} onEdit={() => setEditingDescriptionPath(pathKey(path))} />
            )
          ) : null}
          {isMenuOpen(path) ? (
            <div className="task-node-menu" role="menu" aria-label={`Actions for ${nodeName}`}>
              <button type="button" role="menuitem" onClick={() => { closeMenu(); addChild(path) }} disabled={busy}>Add Child</button>
              <button type="button" role="menuitem" onClick={() => { closeMenu(); beginDescriptionEdit(path, node.description) }} disabled={busy}>{node.description != null ? 'Edit Description' : 'Add Description'}</button>
              <button type="button" role="menuitem" onClick={() => { closeMenu(); void deleteNode(path) }} disabled={busy}>Delete</button>
            </div>
          ) : null}
        </div>
        {node.subtasks.length > 0 ? (
            <ul
              className="task-tree"
              onDragOver={e => { e.preventDefault() }}
              onDrop={e => {
                e.preventDefault()
                try {
                  const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                  const fromParent: number[] = data.parent || []
                  const fromIndex: number = data.index
                  const toParent = path
                  // append to end
                  if (JSON.stringify(fromParent) === JSON.stringify(toParent)) {
                    void reorderSubtasks(toParent, fromIndex, node.subtasks.length)
                  }
                } catch {}
              }}
            >
              {node.subtasks.map((child, childIndex) => renderNode(child, [...path, childIndex]))}
            </ul>
        ) : null}
      </li>
    )
  }

  return (
    <li
      className={`task-node-card ${task.status === 'done' ? 'done' : ''} ${dueDateClass(draft.dueAt)}`}
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
          <div className="task-node-main">
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
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void commitEditing([]) } if (e.key === 'Tab') { e.preventDefault(); addChild([]) } if (e.key === 'Escape') { e.preventDefault(); cancelEditing() } }}
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
              </div>
            )}
            <label className="priority-select">
              <select
                value={draft.priority ?? 'medium'}
                onChange={e => {
                  const nextTask = { ...draft, priority: e.target.value as any }
                  setDraft(cloneTask(nextTask))
                  void saveTask(nextTask)
                }}
                aria-label="Priority"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
          </div>
          <div className="task-due">
            <input
              type="date"
              value={draft.dueAt ? draft.dueAt.slice(0, 10) : ''}
              onClick={e => {
                const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
                el.showPicker?.()
              }}
              onChange={e => {
                const nextTask = {
                  ...draft,
                  dueAt: e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
                }
                setDraft(cloneTask(nextTask))
                void saveTask(nextTask)
              }}
              aria-label={`Due date: ${dueLabel}`}
            />
          </div>
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
          {draft.description != null ? (
            editingDescriptionPath === pathKey([]) ? (
              <textarea
                className="task-node-description task-node-description-row"
                autoFocus
                value={draft.description}
                onChange={e => setDraft(current => ({ ...current, description: e.target.value }))}
                onBlur={() => void commitNode([])}
                onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditingDescriptionPath(null) } if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void commitNode([]) } }}
                aria-label="Task description"
              />
            ) : (
              <DescriptionContent text={draft.description ?? ''} onEdit={() => setEditingDescriptionPath(pathKey([]))} />
            )
          ) : null}
        {isMenuOpen([]) ? (
          <div className="task-node-menu" role="menu" aria-label={`Actions for ${draft.title}`}>
            <button type="button" role="menuitem" onClick={() => { closeMenu(); addChild([]) }} disabled={busy}>Add Child</button>
            <button type="button" role="menuitem" onClick={() => { closeMenu(); beginDescriptionEdit([], draft.description) }} disabled={busy}>{draft.description != null ? 'Edit Description' : 'Add Description'}</button>
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

type Props = {
  tasks?: Task[] | null
  onSave: (t: Task) => Promise<void>
  onDelete: (t: Task) => Promise<void>
}

type StatusFilter = 'all' | 'todo' | 'doing' | 'done'
type PriorityFilter = 'all' | 'high' | 'medium' | 'low'

export default function TaskList({ tasks, onSave, onDelete }: Props) {
  const [sortMode, setSortMode] = useState<'manual' | 'priority' | 'dueAt' | 'title'>(
    () => (localStorage.getItem('taskListSortMode') as any) ?? 'manual'
  )
  const [filterStatus, setFilterStatus] = useState<StatusFilter>(
    () => (localStorage.getItem('taskListFilterStatus') as StatusFilter) ?? 'all'
  )
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>(
    () => (localStorage.getItem('taskListFilterPriority') as PriorityFilter) ?? 'all'
  )

  useEffect(() => { localStorage.setItem('taskListSortMode', sortMode) }, [sortMode])
  useEffect(() => { localStorage.setItem('taskListFilterStatus', filterStatus) }, [filterStatus])
  useEffect(() => { localStorage.setItem('taskListFilterPriority', filterPriority) }, [filterPriority])

  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter(task => !task.deletedAt)

  const orderedTasks = useMemo(() => {
    let list = safeTasks.slice()
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus)
    if (filterPriority !== 'all') list = list.filter(t => t.priority === filterPriority)
    if (sortMode === 'manual') return list
    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return list.sort((a, b) => {
      if (sortMode === 'priority') {
        return (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99)
      }
      if (sortMode === 'dueAt') {
        const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
        const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
        return aTime - bTime
      }
      return a.title.localeCompare(b.title)
    })
  }, [safeTasks, sortMode, filterStatus, filterPriority])

  if (safeTasks.length === 0) return <div>No tasks</div>

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'todo', label: 'Todo' },
    { value: 'doing', label: 'Doing' },
    { value: 'done', label: 'Done' },
  ]
  const priorityChips: { value: PriorityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]

  return (
    <div className="task-list-shell">
      <div className="task-list-toolbar">
        <div className="filter-row">
          <span className="filter-row-label">Status</span>
          <div className="filter-chips">
            {statusChips.map(c => (
              <button
                key={c.value}
                type="button"
                className={`filter-chip${filterStatus === c.value ? ' active' : ''}`}
                onClick={() => setFilterStatus(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-row-label">Priority</span>
          <div className="filter-chips">
            {priorityChips.map(c => (
              <button
                key={c.value}
                type="button"
                className={`filter-chip${filterPriority === c.value ? ' active' : ''}`}
                onClick={() => setFilterPriority(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-row-label">Sort</span>
          <select className="sort-select" value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)}>
            <option value="manual">manual</option>
            <option value="priority">priority</option>
            <option value="dueAt">due date</option>
            <option value="title">title</option>
          </select>
        </div>
      </div>
      {orderedTasks.length === 0 ? (
        <div className="task-list-empty">フィルタに一致するタスクがありません</div>
      ) : (
        <ul className="task-list">
          {orderedTasks.map(t => (
            <TaskRow key={t.id} task={t} onSave={onSave} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
