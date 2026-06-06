import React, { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

export type Toast = {
  id: number
  message: string
  type: ToastType
}

type ToastContextValue = {
  toasts: Toast[]
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
  }
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: { success: () => {}, error: () => {}, info: () => {} },
  dismiss: () => {},
})

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, type: ToastType) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (message: string) => add(message, 'success'),
    error: (message: string) => add(message, 'error'),
    info: (message: string) => add(message, 'info'),
  }

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
