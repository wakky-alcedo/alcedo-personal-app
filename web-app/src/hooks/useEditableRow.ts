import React, { useEffect, useRef, useState } from 'react'

export interface EditableRowState {
  editing: boolean
  busy: boolean
  menuOpen: boolean
  rowRef: React.RefObject<HTMLLIElement>
  setEditing: React.Dispatch<React.SetStateAction<boolean>>
  setBusy: React.Dispatch<React.SetStateAction<boolean>>
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function useEditableRow(): EditableRowState {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const rowRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(e: PointerEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [menuOpen])

  return { editing, setEditing, busy, setBusy, menuOpen, setMenuOpen, rowRef }
}
