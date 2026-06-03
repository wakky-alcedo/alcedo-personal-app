import React, { useState } from 'react'
import { DEFAULT_COLORS } from '../categoryColors.ts'
import { useCategoryColors } from '../CategoryColorsContext.tsx'

export default function CategoryColorsPanel() {
  const { colors, updateColors, addCategory, removeCategory } = useCategoryColors()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6b7280')

  function handleColorChange(cat: string, color: string) {
    updateColors({ ...colors, [cat]: color })
  }

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

  const categories = Object.entries(colors)

  return (
    <div className="settings-group">
      <div className="activity-rules-header">
        <span className="featured-label">カテゴリ</span>
        <button type="button" className="btn btn-secondary" onClick={handleReset}>
          デフォルトに戻す
        </button>
      </div>

      <ul className="activity-rule-list">
        {categories.map(([cat, color]) => (
          <li key={cat} className="category-color-row">
            <span className="category-color-name">{cat}</span>
            <input
              type="color"
              value={color}
              onChange={e => handleColorChange(cat, e.target.value)}
              className="category-color-picker"
              title="色を変更"
            />
            <span className="category-color-hex">{color}</span>
            {color !== DEFAULT_COLORS[cat] && DEFAULT_COLORS[cat] && (
              <button
                type="button"
                className="task-node-menu-button"
                title="デフォルト色に戻す"
                onClick={() => handleColorChange(cat, DEFAULT_COLORS[cat])}
              >↺</button>
            )}
            <button
              type="button"
              className="task-node-menu-button"
              style={{ fontSize: 14, marginLeft: 'auto' }}
              title="削除"
              onClick={() => removeCategory(cat)}
            >×</button>
          </li>
        ))}
      </ul>

      <div className="category-add-form">
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
    </div>
  )
}
