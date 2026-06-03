import React, { createContext, useContext, useState } from 'react'
import { DEFAULT_COLORS, loadColors, saveColors } from './categoryColors.ts'

type Ctx = {
  colors: Record<string, string>
  updateColors: (colors: Record<string, string>) => void
}

const CategoryColorsContext = createContext<Ctx>({
  colors: DEFAULT_COLORS,
  updateColors: () => {},
})

export function CategoryColorsProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<Record<string, string>>(loadColors)

  function updateColors(next: Record<string, string>) {
    saveColors(next)
    setColors(next)
  }

  return (
    <CategoryColorsContext.Provider value={{ colors, updateColors }}>
      {children}
    </CategoryColorsContext.Provider>
  )
}

export function useCategoryColors() {
  return useContext(CategoryColorsContext)
}
