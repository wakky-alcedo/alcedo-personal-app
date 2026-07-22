import { useEffect, useRef, useState } from 'react'
import type { Task, TaskNode } from '../../api.ts'
import { useToast } from '../../contexts/ToastContext.tsx'
import {
  cloneTask, cloneTaskNode, createTaskNode, updateTaskTree, removeTaskTreeNode,
  updateTaskTreeReorder, pathEquals, getNodeAtPath, pathKey, stripEmptySubtasks,
} from './taskTreeUtils.ts'

export interface TaskTreeOps {
  draft: Task
  editingPath: number[] | null
  setEditingPath: (p: number[] | null) => void
  openMenuPath: string | null
  busy: boolean
  editingDescriptionPath: string | null
  setEditingDescriptionPath: (k: string | null) => void
  titleInputRef: React.RefObject<HTMLInputElement>
  editorRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>

  updateRootTask: (next: Task) => void
  updateNode: (path: number[], updater: (n: TaskNode) => TaskNode) => void
  addSiblingAfter: (path: number[]) => void
  addChild: (path: number[]) => void
  reorderSubtasks: (parentPath: number[], fromIndex: number, toIndex: number) => Promise<void>
  saveTask: (task: Task) => Promise<void>
  save: () => Promise<void>
  remove: () => Promise<void>
  setRootStatus: (status: TaskNode['status']) => Promise<void>
  setNodeStatus: (path: number[], status: TaskNode['status']) => Promise<void>
  deleteNode: (path: number[]) => Promise<void>
  commitNode: (path: number[] | null) => Promise<void>
  commitEditing: (path: number[] | null) => Promise<void>
  cancelEditing: () => void
  beginDescriptionEdit: (path: number[], initialValue?: string | null) => void

  pathEquals: typeof pathEquals
  getNodeAtPath: (nodes: TaskNode[], path: number[]) => TaskNode | null
  isMenuOpen: (path: number[]) => boolean
  closeMenu: () => void
  openMenu: (path: number[] | null) => void
}

export function useTaskTree(
  task: Task,
  onSave: (t: Task) => Promise<void>,
  onDelete: (t: Task) => Promise<void>,
): TaskTreeOps {
  const { toast } = useToast()
  const [draft, setDraft] = useState<Task>(() => cloneTask(task))
  const [editingPath, setEditingPath] = useState<number[] | null>(null)
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingDescriptionPath, setEditingDescriptionPath] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editorRefs = useRef(new Map<string, HTMLDivElement | null>())

  useEffect(() => { setDraft(cloneTask(task)) }, [task.version])
  useEffect(() => {
    if (editingPath && editingPath.length === 0) titleInputRef.current?.focus()
  }, [editingPath])

  function updateRootTask(next: Task) { setDraft(cloneTask(next)) }

  function updateNode(path: number[], updater: (n: TaskNode) => TaskNode) {
    if (path.length === 0) {
      setDraft(current => {
        const rootNode: TaskNode = {
          id: current.id,
          title: current.title,
          description: current.description ?? null,
          status: current.status,
          dueAt: current.dueAt ?? null,
          priority: (current as Task & { priority?: string }).priority ?? 'medium' as TaskNode['priority'],
          subtasks: current.subtasks.map(cloneTaskNode),
        }
        const next = updater(rootNode)
        return {
          ...current,
          title: next.title,
          description: next.description ?? null,
          dueAt: next.dueAt ?? null,
          status: next.status,
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
    const target = path.length === 0
      ? { subtasks: draft.subtasks } as TaskNode
      : getNodeAtPath(draft.subtasks, path)
    const newIndex = target ? target.subtasks.length : 0
    updateNode(path, node => ({ ...node, subtasks: [...node.subtasks, createTaskNode()] }))
    setEditingPath([...path, newIndex])
  }

  async function saveTask(nextTask: Task) {
    await onSave({
      ...nextTask,
      title: nextTask.title.trim(),
      description: nextTask.description?.trim() || null,
      dueAt: nextTask.dueAt ? `${nextTask.dueAt.slice(0, 10)}T00:00:00.000Z` : null,
      priority: (nextTask as Task & { priority?: string }).priority ?? 'medium',
    })
  }

  async function reorderSubtasks(parentPath: number[], fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const prev = cloneTask(draft)
    const nextDraft = { ...draft, subtasks: updateTaskTreeReorder(draft.subtasks, parentPath, fromIndex, toIndex) }
    setDraft(cloneTask(nextDraft))
    setBusy(true)
    try { await saveTask(nextDraft) } catch (err) {
      setDraft(prev)
      console.error('reorder failed', err)
      toast.error('タスクの並び替えに失敗しました')
    } finally { setBusy(false) }
  }

  async function save() {
    setBusy(true)
    const prev = cloneTask(draft)
    try { await saveTask(draft); setEditingPath(null) } catch (err) {
      setDraft(prev)
      console.error('save failed', err)
      toast.error('保存に失敗しました')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!window.confirm(`Delete task: ${draft.title}?`)) return
    setBusy(true)
    try { await onDelete(draft) } catch (err) {
      console.error('delete failed', err)
      toast.error('削除に失敗しました')
    } finally { setBusy(false) }
  }

  async function setRootStatus(status: TaskNode['status']) {
    const prev = cloneTask(draft)
    const nextTask = { ...draft, status }
    updateRootTask(nextTask)
    setBusy(true)
    try { await saveTask(nextTask) } catch (err) {
      setDraft(prev)
      console.error('set root status failed', err)
      toast.error('タスクステータスの更新に失敗しました')
    } finally { setBusy(false) }
  }

  async function setNodeStatus(path: number[], status: TaskNode['status']) {
    const prev = cloneTask(draft)
    const nextTask = { ...draft, subtasks: updateTaskTree(draft.subtasks, path, node => ({ ...node, status })) }
    updateRootTask(nextTask)
    setBusy(true)
    try { await saveTask(nextTask) } catch (err) {
      setDraft(prev)
      console.error('set node status failed', err)
      toast.error('サブタスクの更新に失敗しました')
    } finally { setBusy(false) }
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
      toast.error('保存に失敗しました')
    } finally { setBusy(false) }
  }

  async function deleteNode(path: number[]) {
    if (path.length === 0) { await remove(); return }
    const prev = cloneTask(draft)
    const nextTask = { ...draft, subtasks: removeTaskTreeNode(draft.subtasks, path) }
    updateRootTask(nextTask)
    setBusy(true)
    try {
      await saveTask(nextTask)
      if (editingPath && pathEquals(editingPath, path)) setEditingPath(null)
    } catch (err) {
      setDraft(prev)
      console.error('delete node failed', err)
      toast.error('サブタスクの削除に失敗しました')
    } finally { setBusy(false) }
  }

  async function commitEditing(path: number[] | null) { await commitNode(path) }
  function cancelEditing() { setDraft(cloneTask(task)); setEditingPath(null) }

  function beginDescriptionEdit(path: number[], initialValue?: string | null) {
    if (initialValue == null) updateNode(path, node => ({ ...node, description: '' }))
    setEditingDescriptionPath(pathKey(path))
  }

  function isMenuOpen(path: number[]) { return openMenuPath === pathKey(path) }
  function closeMenu() { setOpenMenuPath(null) }
  function openMenu(path: number[] | null) { setOpenMenuPath(pathKey(path)) }

  return {
    draft, editingPath, setEditingPath, openMenuPath, busy,
    editingDescriptionPath, setEditingDescriptionPath,
    titleInputRef, editorRefs,
    updateRootTask, updateNode, addSiblingAfter, addChild,
    reorderSubtasks, saveTask, save, remove,
    setRootStatus, setNodeStatus, deleteNode,
    commitNode, commitEditing, cancelEditing, beginDescriptionEdit,
    pathEquals, getNodeAtPath,
    isMenuOpen, closeMenu, openMenu,
  }
}
