import React from 'react'
import type { Task, TaskNode } from '../../api.ts'
import { useTaskTree } from './useTaskTree.ts'
import { pathKey, pathLabel, dueDateClass, updateTaskTree, nextStatus, statusLabel } from './taskTreeUtils.ts'
import { DescriptionField, NodeActionsMenu, PrioritySelect, dateInputToDueAt, readDragPayload, samePath, showPicker, writeDragPayload } from './TaskNodeParts.tsx'

type Props = {
  task: Task
  onSave: (t: Task) => Promise<void>
  onDelete: (t: Task) => Promise<void>
}

export default function TaskRow({ task, onSave, onDelete }: Props) {
  const ops = useTaskTree(task, onSave, onDelete)
  const {
    draft, editingPath, busy,
    editingDescriptionPath, titleInputRef, editorRefs,
    updateNode, addSiblingAfter, addChild,
    reorderSubtasks, saveTask,
    setRootStatus, setNodeStatus, deleteNode, commitNode,
    commitEditing, cancelEditing, beginDescriptionEdit,
    pathEquals,
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
          writeDragPayload(e, { parent: path.slice(0, -1), index: path[path.length - 1] })
        }}
        onDragOver={e => { e.preventDefault() }}
        onDrop={e => {
          e.preventDefault()
          const from = readDragPayload(e)
          const toParent = path.slice(0, -1)
          if (from && samePath(from.parent, toParent)) void reorderSubtasks(toParent, from.index, path[path.length - 1])
        }}
        className={`task-node-card ${node.status === 'done' ? 'done' : ''} ${dueDateClass(node.dueAt)}`}
        role="listitem"
        aria-label={nodeName}
        onContextMenu={event => { event.preventDefault(); openMenu(path) }}
      >
        <div className="task-node-body">
          <div className="task-node-head">
            <button
              type="button"
              className={`status-cycle-button status-${node.status}`}
              onClick={() => void setNodeStatus(path, nextStatus(node.status))}
              disabled={busy}
              aria-label={`Status for ${nodeName}: ${node.status} (click to change)`}
            >
              {statusLabel(node.status)}
            </button>
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
              <PrioritySelect
                value={node.priority ?? 'medium'}
                onChange={priority => void saveTask({ ...draft, subtasks: updateTaskTree(draft.subtasks, path, n => ({ ...n, priority })) })}
                ariaLabel={`Priority for ${nodeName}`}
              />
            </div>
            <div className="task-due">
              <input
                type="date"
                value={node.dueAt ? node.dueAt.slice(0, 10) : ''}
                onClick={showPicker}
                onChange={e => {
                  const dueAt = dateInputToDueAt(e.target.value)
                  void saveTask({ ...draft, subtasks: updateTaskTree(draft.subtasks, path, n => ({ ...n, dueAt })) })
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
          <DescriptionField
            description={node.description}
            editing={editingDescriptionPath === pathKey(path)}
            onChange={text => updateNode(path, n => ({ ...n, description: text }))}
            onCommit={() => void commitNode(path)}
            onCancel={() => setEditingDescriptionPath(null)}
            onBeginEdit={() => setEditingDescriptionPath(pathKey(path))}
            ariaLabel={`Description for ${nodeName}`}
          />
          {isMenuOpen(path) ? (
            <NodeActionsMenu
              label={nodeName}
              hasDescription={node.description != null}
              busy={busy}
              onAddChild={() => { closeMenu(); addChild(path) }}
              onEditDescription={() => { closeMenu(); beginDescriptionEdit(path, node.description) }}
              onDelete={() => { closeMenu(); void deleteNode(path) }}
            />
          ) : null}
        </div>
        {node.subtasks.length > 0 ? (
          <ul
            className="task-tree"
            onDragOver={e => { e.preventDefault() }}
            onDrop={e => {
              e.preventDefault()
              const from = readDragPayload(e)
              if (from && samePath(from.parent, path)) void reorderSubtasks(path, from.index, node.subtasks.length)
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
          <button
            type="button"
            className={`status-cycle-button status-${draft.status}`}
            onClick={() => void setRootStatus(nextStatus(draft.status))}
            disabled={busy}
            aria-label={`Status for ${draft.title}: ${draft.status} (click to change)`}
          >
            {statusLabel(draft.status)}
          </button>
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
                  onChange={e => updateNode([], n => ({ ...n, title: e.target.value }))}
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
            <PrioritySelect
              value={draft.priority ?? 'medium'}
              onChange={priority => void saveTask({ ...draft, priority })}
              ariaLabel="Priority"
            />
          </div>
          <div className="task-due">
            <input
              type="date"
              value={draft.dueAt ? draft.dueAt.slice(0, 10) : ''}
              onClick={showPicker}
              onChange={e => {
                const dueAt = dateInputToDueAt(e.target.value)
                // A time without a date is meaningless, so clearing the date clears the time.
                void saveTask({ ...draft, dueAt, dueTime: dueAt ? draft.dueTime : null })
              }}
              aria-label={`Due date: ${dueLabel}`}
            />
            <input
              type="time"
              value={draft.dueTime ?? ''}
              disabled={!draft.dueAt}
              onClick={showPicker}
              onChange={e => void saveTask({ ...draft, dueTime: e.target.value || null })}
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
        <DescriptionField
          description={draft.description}
          editing={editingDescriptionPath === pathKey([])}
          onChange={text => updateNode([], n => ({ ...n, description: text }))}
          onCommit={() => void commitNode([])}
          onCancel={() => setEditingDescriptionPath(null)}
          onBeginEdit={() => setEditingDescriptionPath(pathKey([]))}
          ariaLabel="Task description"
        />
        {isMenuOpen([]) ? (
          <NodeActionsMenu
            label={draft.title}
            hasDescription={draft.description != null}
            busy={busy}
            onAddChild={() => { closeMenu(); addChild([]) }}
            onEditDescription={() => { closeMenu(); beginDescriptionEdit([], draft.description) }}
            onDelete={() => { closeMenu(); ops.remove() }}
          />
        ) : null}
        <ul className="task-tree">
          {draft.subtasks.map((node, index) => renderNode(node, [index]))}
        </ul>
      </div>
    </li>
  )
}
