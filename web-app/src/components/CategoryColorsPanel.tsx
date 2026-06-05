import React, { useState } from 'react'
import { DEFAULT_COLORS } from '../categoryColors.ts'
import { useCategoryColors } from '../CategoryColorsContext.tsx'

export default function CategoryColorsPanel() {
  const { colors, updateColors, addCategory, removeCategory } = useCategoryColors()
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState('#6b7280')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [draftName, setDraftName]     = useState('')

  function handleColorChange(cat: string, color: string) {
    updateColors({ ...colors, [cat]: color })
  }

  function startEditName(cat: string) {
    setEditingName(cat)
    setDraftName(cat)
  }

  function commitRename(oldName: string) {
    const newN = draftName.trim()
    setEditingName(null)
    if (!newN || newN === oldName || newN in colors) return
    const next = { ...colors }
    next[newN] = next[oldName]
    delete next[oldName]
    updateColors(next)
  }

  function cancelRename() { setEditingName(null); setDraftName('') }

  function handleAdd() {
    const name = newName.trim()
    if (!name || name in colors) return
    addCategory(name, newColor)
    setNewName('')
    setNewColor('#6b7280')
  }

  function handleReset() {
    if (!window.confirm('カテゴリをデフォルトに戻しますか？追加したカテゴリは削除されます。')) return
    updateColors({ ...DEFAULT_COLORS })
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="activity-rules-header" style={{ marginBottom: 8 }}>
        <span className="featured-label">カテゴリ</span>
        <button type="button" className="btn btn-secondary" onClick={handleReset}>
          デフォルトに戻す
        </button>
      </div>

      {/* 追加フォーム（上部） */}
      <div className="category-add-form" style={{ marginBottom: 8 }}>
        <input
          className="settings-input"
          placeholder="新しいカテゴリ名"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1 }}
        />
        <input
          type="color"
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
          className="category-color-picker"
          title="色を選択"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={!newName.trim() || newName.trim() in colors}
        >追加</button>
      </div>

      {/* カテゴリ一覧 */}
      <ul className="activity-rule-list">
        {Object.entries(colors).map(([cat, color]) => (
          <li key={cat} className="category-color-row">
            {editingName === cat ? (
              <input
                autoFocus
                className="settings-input"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onBlur={() => commitRename(cat)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(cat) }
                  if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                }}
                style={{ flex: 1, minWidth: 80, fontSize: 13, padding: '2px 6px' }}
              />
            ) : (
              <button
                type="button"
                className="link-button category-color-name"
                title="クリックして名前を編集"
                onClick={() => startEditName(cat)}
              >
                {cat}
              </button>
            )}
            <input
              type="color"
              value={color}
              onChange={e => handleColorChange(cat, e.target.value)}
              className="category-color-picker"
              title="色を変更"
            />
            <span className="category-color-hex">{color}</span>
            {color !== DEFAULT_COLORS[cat] && DEFAULT_COLORS[cat] && (
              <button type="button" className="task-node-menu-button"
                title="デフォルト色に戻す"
                onClick={() => handleColorChange(cat, DEFAULT_COLORS[cat])}>↺</button>
            )}
            <button type="button" className="task-node-menu-button"
              style={{ fontSize: 14, marginLeft: 'auto' }}
              title="削除" onClick={() => removeCategory(cat)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
