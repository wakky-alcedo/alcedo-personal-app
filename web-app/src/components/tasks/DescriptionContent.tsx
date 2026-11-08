import React from 'react'

const URL_RE = /(https?:\/\/[^\s]+)/g

/** Read-only description with Ctrl/⌘+click-to-open URLs; clicking elsewhere starts editing. */
export default function DescriptionContent({ text, onEdit }: { text: string; onEdit: () => void }) {
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
