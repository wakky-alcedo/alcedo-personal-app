import React from 'react'
import { DEFAULT_COLORS } from '../categoryColors.ts'
import { useCategoryColors } from '../CategoryColorsContext.tsx'

export default function CategoryColorsPanel() {
  const { colors, updateColors } = useCategoryColors()

  function handleChange(cat: string, color: string) {
    updateColors({ ...colors, [cat]: color })
  }

  function handleReset() {
    updateColors({ ...DEFAULT_COLORS })
  }

  return (
    <div className="settings-group">
      <div className="activity-rules-header">
        <span className="featured-label">カテゴリ色</span>
        <button type="button" className="btn btn-secondary" onClick={handleReset}>
          デフォルトに戻す
        </button>
      </div>
      <div className="category-colors-grid">
        {Object.keys(DEFAULT_COLORS).map(cat => {
          const color = colors[cat] ?? DEFAULT_COLORS[cat]
          const isModified = color !== DEFAULT_COLORS[cat]
          return (
            <label key={cat} className="category-color-row">
              <span className="category-color-name">{cat}</span>
              <input
                type="color"
                value={color}
                onChange={e => handleChange(cat, e.target.value)}
                className="category-color-picker"
              />
              <span className="category-color-hex">{color}</span>
              {isModified && (
                <button
                  type="button"
                  className="task-node-menu-button"
                  title="リセット"
                  onClick={() => handleChange(cat, DEFAULT_COLORS[cat])}
                >↺</button>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}
