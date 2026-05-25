import { useEffect, useRef, type ReactNode } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = '640px' }: Props) {
  const { theme } = useTheme()
  const mouseDownOnBackdrop = useRef(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget }}
      onClick={e => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: theme.surface, border: `1px solid ${theme.border}`, maxWidth, maxHeight: '90vh' }}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <h3 className="text-base font-bold" style={{ color: theme.text }}>{title}</h3>
            <button onClick={onClose} aria-label="Close" style={{ color: theme.text2 }} className="p-1 hover:opacity-70">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-auto p-6">{children}</div>
      </div>
    </div>
  )
}
