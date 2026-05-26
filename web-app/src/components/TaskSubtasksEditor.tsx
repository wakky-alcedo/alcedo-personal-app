import React from 'react'
import type { TaskNode } from '../api.ts'

type Props = {
  subtasks: TaskNode[]
  onChange: (nextSubtasks: TaskNode[]) => void
  depth?: number
}

function createTaskNode(title = ''): TaskNode {
  return {
    id: crypto.randomUUID(),
    title,
    done: false,
    dueAt: null,
    priority: 'low',
    subtasks: [],
  }
}

function TaskNodeEditor({ node, index, depth = 0, onChange, onDelete }: { node: TaskNode; index: number; depth?: number; onChange: (nextNode: TaskNode) => void; onDelete: () => void }) {
  return (
    <div className="subtask-row" style={{ marginLeft: depth * 16 }}>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={node.done}
          onChange={event => onChange({ ...node, done: event.target.checked })}
        />
        done
      </label>
      <input
        value={node.title}
        onChange={event => onChange({ ...node, title: event.target.value })}
        placeholder={`Child task ${index + 1}`}
      />
      <button type="button" onClick={onDelete}>Remove</button>
      <div className="subtasks-editor child-editor">
        <TaskSubtasksEditor
          subtasks={node.subtasks}
          depth={depth + 1}
          onChange={nextSubtasks => onChange({ ...node, subtasks: nextSubtasks })}
        />
      </div>
    </div>
  )
}

export default function TaskSubtasksEditor({ subtasks, onChange, depth = 0 }: Props) {
  function updateNode(index: number, nextNode: TaskNode) {
    onChange(subtasks.map((node, nodeIndex) => (nodeIndex === index ? nextNode : node)))
  }

  function addNode() {
    // Previously appended an empty child node. Removing automatic empty child creation
    // per UI decision: subtasks are added via the task actions menu instead.
  }

  function removeNode(index: number) {
    onChange(subtasks.filter((_, nodeIndex) => nodeIndex !== index))
  }

  return (
    <div className="subtasks-editor">
      {/* Removed "Child tasks" heading and empty-state text to simplify UI */}
      <div className="subtasks-list">
        {subtasks.map((node, index) => (
          <TaskNodeEditor
            key={node.id}
            node={node}
            index={index}
            depth={depth}
            onChange={nextNode => updateNode(index, nextNode)}
            onDelete={() => removeNode(index)}
          />
        ))}
      </div>
      {/* Removed inline "Add Child Task" button to avoid creating empty subtasks by default */}
    </div>
  )
}