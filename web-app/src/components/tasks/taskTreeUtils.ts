import type { Task, TaskNode } from '../../api.ts'

export function cloneTaskNode(n: TaskNode): TaskNode {
  return { ...n, subtasks: n.subtasks.map(cloneTaskNode) }
}

export function cloneTask(t: Task): Task {
  return { ...t, subtasks: t.subtasks.map(cloneTaskNode) }
}

export function createTaskNode(): TaskNode {
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

export function updateTaskTree(
  nodes: TaskNode[],
  path: number[],
  updater: (node: TaskNode) => TaskNode,
): TaskNode[] {
  if (path.length === 0) throw new Error('invalid path for updateTaskTree')
  const [idx, ...rest] = path
  return nodes.map((n, i) => {
    if (i !== idx) return n
    if (rest.length === 0) return updater(n)
    return { ...n, subtasks: updateTaskTree(n.subtasks, rest, updater) }
  })
}

export function removeTaskTreeNode(nodes: TaskNode[], path: number[]): TaskNode[] {
  if (path.length === 0) return nodes
  const [idx, ...rest] = path
  if (rest.length === 0) return nodes.filter((_, i) => i !== idx)
  return nodes.map((n, i) => (i !== idx ? n : { ...n, subtasks: removeTaskTreeNode(n.subtasks, rest) }))
}

export function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

export function updateTaskTreeReorder(
  nodes: TaskNode[],
  path: number[],
  fromIndex: number,
  toIndex: number,
): TaskNode[] {
  if (path.length === 0) return moveInArray(nodes, fromIndex, toIndex)
  const [idx, ...rest] = path
  return nodes.map((n, i) => {
    if (i !== idx) return n
    return { ...n, subtasks: updateTaskTreeReorder(n.subtasks, rest, fromIndex, toIndex) }
  })
}

export function pathEquals(a: number[] | null, b: number[]): boolean {
  if (!a) return false
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

export function getNodeAtPath(nodes: TaskNode[], path: number[]): TaskNode | null {
  let cur: TaskNode | null = null
  let arr = nodes
  for (const idx of path) {
    if (!arr || idx < 0 || idx >= arr.length) return null
    cur = arr[idx]
    arr = cur.subtasks
  }
  return cur
}

export function pathKey(path: number[] | null): string {
  if (path === null) return 'none'
  if (path.length === 0) return 'root'
  return path.join('-')
}

export function pathLabel(path: number[]): string {
  return path.length === 0 ? 'root' : path.join('.')
}

export function dueDateClass(dueAt: string | null | undefined): string {
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

export function stripEmptySubtasks(nodes: TaskNode[]): TaskNode[] {
  return nodes
    .filter(n => n.title.trim() !== '')
    .map(n => ({ ...n, subtasks: stripEmptySubtasks(n.subtasks) }))
}
