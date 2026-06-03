import React, { createContext, useContext, useState } from 'react'
import { DEFAULT_COLORS, loadColors, saveColors } from './categoryColors.ts'

type Ctx = {
  colors: Record<string, string>
  updateColors: (colors: Record<string, string>) => void
  addCategory: (name: string, color: string) => void
  removeCategory: (name: string) => void
}

const CategoryColorsContext = createContext<Ctx>({
  colors: DEFAULT_COLORS,
  updateColors: () => {},
  addCategory: () => {},
  removeCategory: () => {},
})

export function CategoryColorsProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<Record<string, string>>(loadColors)

  function updateColors(next: Record<string, string>) {
    saveColors(next)
    setColors(next)
  }

  function addCategory(name: string, color: string) {
    if (!name.trim() || name in colors) return
    updateColors({ ...colors, [name.trim()]: color })
  }

  function removeCategory(name: string) {
    const next = { ...colors }
    delete next[name]
    updateColors(next)
  }

  return (
    <CategoryColorsContext.Provider value={{ colors, updateColors, addCategory, removeCategory }}>
      {children}
    </CategoryColorsContext.Provider>
  )
}

export function useCategoryColors() {
  return useContext(CategoryColorsContext)
}
