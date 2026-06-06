import React from 'react'
import { useToast } from '../contexts/ToastContext.tsx'

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container" role="region" aria-label="通知">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`} role="alert">
          <span className="toast-message">{t.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="閉じる"
          >×</button>
        </div>
      ))}
    </div>
  )
}
