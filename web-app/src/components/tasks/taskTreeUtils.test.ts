import { describe, it, expect } from 'vitest'
import {
  updateTaskTree,
  removeTaskTreeNode,
  moveInArray,
  updateTaskTreeReorder,
  pathEquals,
  getNodeAtPath,
  stripEmptySubtasks,
  dueDateClass,
} from './taskTreeUtils'
import type { TaskNode } from '../../api'

function makeNode(title: string, subtasks: TaskNode[] = []): TaskNode {
  return {
    id: title,
    title,
    description: null,
    done: false,
    dueAt: null,
    priority: 'medium',
    parentId: null,
    subtasks,
  }
}

describe('updateTaskTree', () => {
  it('updates a root-level node by index', () => {
    const tree = [makeNode('A'), makeNode('B')]
    const result = updateTaskTree(tree, [1], n => ({ ...n, title: 'B2' }))
    expect(result[0].title).toBe('A')
    expect(result[1].title).toBe('B2')
  })
  it('updates a nested node', () => {
    const tree = [makeNode('A', [makeNode('A1'), makeNode('A2')])]
    const result = updateTaskTree(tree, [0, 1], n => ({ ...n, title: 'A2-updated' }))
    expect(result[0].subtasks[1].title).toBe('A2-updated')
    expect(result[0].subtasks[0].title).toBe('A1')
  })
  it('does not mutate the original tree', () => {
    const tree = [makeNode('A')]
    updateTaskTree(tree, [0], n => ({ ...n, title: 'X' }))
    expect(tree[0].title).toBe('A')
  })
  it('throws on empty path', () => {
    expect(() => updateTaskTree([makeNode('A')], [], n => n)).toThrow()
  })
})

describe('removeTaskTreeNode', () => {
  it('removes a root-level node', () => {
    const tree = [makeNode('A'), makeNode('B'), makeNode('C')]
    const result = removeTaskTreeNode(tree, [1])
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('A')
    expect(result[1].title).toBe('C')
  })
  it('removes a nested node', () => {
    const tree = [makeNode('A', [makeNode('A1'), makeNode('A2')])]
    const result = removeTaskTreeNode(tree, [0, 0])
    expect(result[0].subtasks).toHaveLength(1)
    expect(result[0].subtasks[0].title).toBe('A2')
  })
  it('returns unchanged when path is empty', () => {
    const tree = [makeNode('A')]
    expect(removeTaskTreeNode(tree, [])).toEqual(tree)
  })
})

describe('moveInArray', () => {
  it('moves item forward', () => {
    expect(moveInArray([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
  })
  it('moves item backward', () => {
    expect(moveInArray([1, 2, 3, 4], 3, 1)).toEqual([1, 4, 2, 3])
  })
  it('no-op when from equals to', () => {
    expect(moveInArray([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
  })
})

describe('updateTaskTreeReorder', () => {
  it('reorders root-level nodes', () => {
    const tree = [makeNode('A'), makeNode('B'), makeNode('C')]
    const result = updateTaskTreeReorder(tree, [], 0, 2)
    expect(result.map(n => n.title)).toEqual(['B', 'C', 'A'])
  })
  it('reorders nested nodes', () => {
    const tree = [makeNode('A', [makeNode('A1'), makeNode('A2'), makeNode('A3')])]
    const result = updateTaskTreeReorder(tree, [0], 0, 2)
    expect(result[0].subtasks.map(n => n.title)).toEqual(['A2', 'A3', 'A1'])
  })
})

describe('pathEquals', () => {
  it('returns true for equal paths', () => {
    expect(pathEquals([0, 1, 2], [0, 1, 2])).toBe(true)
    expect(pathEquals([], [])).toBe(true)
  })
  it('returns false for different paths', () => {
    expect(pathEquals([0], [1])).toBe(false)
    expect(pathEquals([0, 1], [0])).toBe(false)
  })
  it('returns false for null', () => {
    expect(pathEquals(null, [0])).toBe(false)
    expect(pathEquals(null, [])).toBe(false)
  })
})

describe('getNodeAtPath', () => {
  it('returns the root node by index', () => {
    const tree = [makeNode('A'), makeNode('B')]
    expect(getNodeAtPath(tree, [0])?.title).toBe('A')
    expect(getNodeAtPath(tree, [1])?.title).toBe('B')
  })
  it('returns a nested node', () => {
    const tree = [makeNode('A', [makeNode('A1'), makeNode('A2')])]
    expect(getNodeAtPath(tree, [0, 1])?.title).toBe('A2')
  })
  it('returns null for out-of-bounds index', () => {
    expect(getNodeAtPath([], [0])).toBeNull()
    expect(getNodeAtPath([makeNode('A')], [5])).toBeNull()
  })
})

describe('stripEmptySubtasks', () => {
  it('filters nodes with blank titles', () => {
    const tree = [makeNode('A'), makeNode(''), makeNode('  '), makeNode('C')]
    const result = stripEmptySubtasks(tree)
    expect(result.map(n => n.title)).toEqual(['A', 'C'])
  })
  it('recursively strips nested empty nodes', () => {
    const tree = [makeNode('A', [makeNode(''), makeNode('A1')])]
    const result = stripEmptySubtasks(tree)
    expect(result[0].subtasks).toHaveLength(1)
    expect(result[0].subtasks[0].title).toBe('A1')
  })
})

describe('dueDateClass', () => {
  it('returns empty string when no dueAt', () => {
    expect(dueDateClass(null)).toBe('')
    expect(dueDateClass(undefined)).toBe('')
  })
  it('returns due-overdue for past dates', () => {
    expect(dueDateClass('2000-01-01T00:00:00.000Z')).toBe('due-overdue')
  })
  it('returns due-today for today', () => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    expect(dueDateClass(today.toISOString())).toBe('due-today')
  })
})
