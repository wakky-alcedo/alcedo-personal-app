import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen, waitFor } from '@testing-library/react'
import TaskRow from './TaskRow.tsx'
import { dateInputToDueAt, readDragPayload, samePath } from './TaskNodeParts.tsx'
import type { Task } from '../../api.ts'

const task: Task = {
  id: 't1', title: 'Root', description: null, categoryType: 'short_term', categoryName: 'today',
  priority: 'high', dueAt: '2026-08-05T00:00:00.000Z', dueTime: '09:30', status: 'todo', updatedAt: '', version: 1,
  subtasks: [{ id: 's1', title: 'Child', description: null, status: 'todo', dueAt: null, priority: 'low', parentId: null, subtasks: [] }],
}

afterEach(cleanup)

function mount() {
  const onSave = vi.fn(async (_t: Task) => {})
  render(<ul><TaskRow task={task} onSave={onSave} onDelete={async () => {}} /></ul>)
  return onSave
}

describe('TaskRow', () => {
  it('changes a subtask priority without touching the root', async () => {
    const onSave = mount()
    fireEvent.change(screen.getByLabelText('Priority for Child'), { target: { value: 'high' } })
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = onSave.mock.calls[0][0]
    expect(saved.priority).toBe('high')
    expect(saved.subtasks[0].priority).toBe('high')
  })

  it('clearing the root due date also clears the due time', async () => {
    const onSave = mount()
    fireEvent.change(screen.getByLabelText(/^Due date:/, { selector: '.task-node-card[aria-label="Root"] > .task-node-body > .task-node-head input' }), { target: { value: '' } })
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ dueAt: null, dueTime: null })
  })
})

describe('TaskNodeParts helpers', () => {
  it('maps date input values to UTC-midnight dueAt', () => {
    expect(dateInputToDueAt('2026-08-05')).toBe('2026-08-05T00:00:00.000Z')
    expect(dateInputToDueAt('')).toBeNull()
  })

  it('reads drag payloads defensively', () => {
    const ev = (data: string) => ({ dataTransfer: { getData: () => data } }) as unknown as React.DragEvent
    expect(readDragPayload(ev('{"parent":[0],"index":2}'))).toEqual({ parent: [0], index: 2 })
    expect(readDragPayload(ev('{"index":1}'))).toEqual({ parent: [], index: 1 })
    expect(readDragPayload(ev('https://example.com'))).toBeNull()
    expect(readDragPayload(ev('{"parent":[0]}'))).toBeNull()
  })

  it('compares paths by value', () => {
    expect(samePath([0, 1], [0, 1])).toBe(true)
    expect(samePath([0], [0, 1])).toBe(false)
  })
})
