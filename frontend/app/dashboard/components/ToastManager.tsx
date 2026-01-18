import React, { createContext, useContext, useState, useCallback } from 'react'

export type Toast = {
  id: string
  message: string
  action?: { label: string; onClick: () => void }
  duration?: number
}

const ToastContext = createContext<{ showToast: (t: Omit<Toast, 'id'>) => void } | null>(null)

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  const { showToast } = ctx
  return { showToast }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const toast: Toast = { id, ...t }
    setToasts((s) => [...s, toast])
    if (toast.duration !== 0) {
      const dur = toast.duration ?? 1500
      setTimeout(() => {
        setToasts((s) => s.filter(x => x.id !== id))
      }, dur)
    }
  }, [])

  const remove = useCallback((id: string) => setToasts((s) => s.filter(x => x.id !== id)), [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div key={t.id} className="bg-black/85 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
            <div className="text-sm">{t.message}</div>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); remove(t.id) }}
                className="ml-2 bg-white text-black px-2 py-1 rounded text-sm"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => remove(t.id)} className="ml-2 text-white/70">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
