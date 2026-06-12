import React from 'react'
import type { Task, TaskNode } from '../../api.ts'
import { useTaskTree } from './useTaskTree.ts'
import { pathKey, pathLabel, dueDateClass, updateTaskTree } from './taskTreeUtils.ts'

const URL_RE = /(https?:\/\/[^\s]+)/g

function DescriptionContent({ text, onEdit }: { text: string; onEdit: () => void }) {
  const parts = text.split(URL_RE)
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

type Props = {
  task: Task
  onSave: (t: Task) => Promise<void>
  onDelete: (t: Task) => Promise<void>
}

export default function TaskRow({ task, onSave, onDelete }: Props) {
  const ops = useTaskTree(task, onSave, onDelete)
  const {
    draft, editingPath, openMenuPath, busy,
    editingDescriptionPath, titleInputRef, editorRefs,
    updateNode, addSiblingAfter, addChild,
    reorderSubtasks, saveTask,
    save: _save, toggleRootDone, toggleNodeDone, deleteNode, commitNode,
    commitEditing, cancelEditing, beginDescriptionEdit,
    pathEquals, getNodeAtPath,
    isMenuOpen, closeMenu, openMenu,
    setEditingPath, setEditingDescriptionPath,
  } = ops

  const dueLabel = draft.dueAt ? new Date(draft.dueAt).toLocaleDateString() : 'No due'

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
          } catch {}
        }}
        className={`task-node-card ${node.done ? 'done' : ''} ${dueDateClass(node.dueAt)}`}
        role="listitem"
        aria-label={nodeName}
        onContextMenu={event => { event.preventDefault(); openMenu(path) }}
      >
        <div className="task-node-body">
          <div className="task-node-head">
            <label className="checkbox-row task-node-check">
              <input
                type="checkbox"
                checked={node.done}
                onChange={event => void (
                  path.length === 0
                    ? toggleRootDone(event.target.checked)
                    : toggleNodeDone(path, event.target.checked)
                )}
                disabled={busy}
                aria-label={`Mark ${nodeName} as done`}
              />
            </label>
            <div className="task-node-main">
              {!isEditingNode ? (
                <button
                  type="button"
                  className="link-button task-node-title"
                  onClick={() => setEditingPath(path)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingPath(path) } }}
                  aria-label={nodeName}
                  disabled={busy}
                >
                  {nodeName}
                </button>
              ) : (
                <div className="inline-editor" ref={el => editorRefs.current.set(pathKey(path), el)}>
                  <input
                    autoFocus
                    value={node.title}
                    onChange={e => updateNode(path, n => ({ ...n, title: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addSiblingAfter(path) }
                      if (e.key === 'Tab') { e.preventDefault(); addChild(path) }
                      if (e.key === 'Escape') { e.preventDefault(); cancelEditing() }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        const el = editorRefs.current.get(pathKey(path))
                        if (!el) return
                        if (!el.contains(document.activeElement)) void commitEditing(path)
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
                      subtasks: updateTaskTree(draft.subtasks, path, n => ({
                        ...n, priority: e.target.value as TaskNode['priority'],
                      })),
                    }
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
                      ...n, dueAt: e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
                    })),
                  }
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
            >⋯</button>
          </div>
          {node.description != null ? (
            editingDescriptionPath === pathKey(path) ? (
              <textarea
                className="task-node-description task-node-description-row"
                autoFocus
                value={node.description}
                onChange={e => updateNode(path, n => ({ ...n, description: e.target.value }))}
                onBlur={() => void commitNode(path)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { e.preventDefault(); setEditingDescriptionPath(null) }
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void commitNode(path) }
                }}
                aria-label={`Description for ${nodeName}`}
              />
            ) : (
              <DescriptionContent
                text={node.description ?? ''}
                onEdit={() => setEditingDescriptionPath(pathKey(path))}
              />
            )
          ) : null}
          {isMenuOpen(path) ? (
            <div className="task-node-menu" role="menu" aria-label={`Actions for ${nodeName}`}>
              <button type="button" role="menuitem" onClick={() => { closeMenu(); addChild(path) }} disabled={busy}>Add Child</button>
              <button type="button" role="menuitem" onClick={() => { closeMenu(); beginDescriptionEdit(path, node.description) }} disabled={busy}>
                {node.description != null ? 'Edit Description' : 'Add Description'}
              </button>
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
      onContextMenu={event => { event.preventDefault(); openMenu([]) }}
    >
      <div className="task-node-body">
        <div className="task-node-head">
          <label className="checkbox-row task-node-check">
            <input
              type="checkbox"
              checked={draft.status === 'done'}
              onChange={event => void toggleRootDone(event.target.checked)}
              disabled={busy}
              aria-label={`Mark ${draft.title} as done`}
            />
          </label>
          <div className="task-node-main">
            {!pathEquals(editingPath, []) ? (
              <button
                type="button"
                className="link-button task-node-title"
                onClick={() => setEditingPath([])}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingPath([]) } }}
                aria-label={draft.title}
                disabled={busy}
              >
                {draft.title}
              </button>
            ) : (
              <div className="inline-editor" ref={el => editorRefs.current.set(pathKey([]), el)}>
                <input
                  ref={titleInputRef}
                  value={draft.title}
                  onChange={e => ops.updateNode([], n => ({ ...n, title: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); void commitEditing([]) }
                    if (e.key === 'Tab') { e.preventDefault(); addChild([]) }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEditing() }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      const el = editorRefs.current.get(pathKey([]))
                      if (!el) return
                      if (!el.contains(document.activeElement)) void commitEditing([])
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
                  const nextTask = { ...draft, priority: e.target.value as Task['priority'] }
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
                const nextDueAt = e.target.value ? `${e.target.value}T00:00:00.000Z` : null
                const nextTask = { ...draft, dueAt: nextDueAt, dueTime: nextDueAt ? draft.dueTime : null }
                void saveTask(nextTask)
              }}
              aria-label={`Due date: ${dueLabel}`}
            />
            <input
              type="time"
              value={draft.dueTime ?? ''}
              disabled={!draft.dueAt}
              onClick={e => {
                const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
                el.showPicker?.()
              }}
              onChange={e => {
                const nextTask = { ...draft, dueTime: e.target.value || null }
                void saveTask(nextTask)
              }}
              aria-label={`Due time: ${draft.dueTime ?? 'Not set'}`}
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
          >⋯</button>
        </div>
        {draft.description != null ? (
          editingDescriptionPath === pathKey([]) ? (
            <textarea
              className="task-node-description task-node-description-row"
              autoFocus
              value={draft.description}
              onChange={e => ops.updateNode([], n => ({ ...n, description: e.target.value }))}
              onBlur={() => void commitNode([])}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); setEditingDescriptionPath(null) }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void commitNode([]) }
              }}
              aria-label="Task description"
            />
          ) : (
            <DescriptionContent
              text={draft.description ?? ''}
              onEdit={() => setEditingDescriptionPath(pathKey([]))}
            />
          )
        ) : null}
        {isMenuOpen([]) ? (
          <div className="task-node-menu" role="menu" aria-label={`Actions for ${draft.title}`}>
            <button type="button" role="menuitem" onClick={() => { closeMenu(); addChild([]) }} disabled={busy}>Add Child</button>
            <button type="button" role="menuitem" onClick={() => { closeMenu(); beginDescriptionEdit([], draft.description) }} disabled={busy}>
              {draft.description != null ? 'Edit Description' : 'Add Description'}
            </button>
            <button type="button" role="menuitem" onClick={() => { closeMenu(); ops.remove() }} disabled={busy}>Delete</button>
          </div>
        ) : null}
        <ul className="task-tree">
          {draft.subtasks.map((node, index) => renderNode(node, [index]))}
        </ul>
      </div>
    </li>
  )
}
