import { useEffect, useState, useCallback } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useDocuments } from '@/contexts/DocumentsContext'
import Footer from '@/components/Footer'
import { UploadModal } from '@/components/UploadModal'
import KeyboardShortcuts from '@/components/KeyboardShortcuts'

const DocumentsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
  </svg>
)

const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 3a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V3zM11 3a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V3zM11 11a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM3 14a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
  </svg>
)

const InboxIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M8 4a3 3 0 00-3 4v4a3 3 0 001.283 2.458l.95 1.52a1 1 0 00.834.63h3.886a1 1 0 00.834-.63l.95-1.52A3 3 0 0015 8V6a1 1 0 00-1-1H8z" />
    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
  </svg>
)

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
)

const LogoMark = () => (
  <img src="/favicon.svg" width={28} height={28} alt="Vaulty" className="shrink-0" />
)

export default function Layout() {
  const { theme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const { refresh } = useDocuments()
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [keySequence, setKeySequence] = useState<string[]>([])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowShortcuts(prev => !prev);
      return;
    }

    if (keySequence.length === 1 && keySequence[0] === 'g') {
      e.preventDefault();
      switch (e.key.toLowerCase()) {
        case 'd':
          navigate('/documents');
          break;
        case 'h':
          navigate('/');
          break;
        case 'i':
          navigate('/inbox');
          break;
        case 's':
          navigate('/settings');
          break;
      }
      setKeySequence([]);
      return;
    }

    if (e.key === 'g' && !keySequence.length) {
      e.preventDefault();
      setKeySequence(['g']);
      setTimeout(() => setKeySequence([]), 1000);
      return;
    }

    if (e.key === 'Escape') {
      setKeySequence([]);
    }
  }, [keySequence, navigate]);

  useEffect(() => {
    let dragDepth = 0

    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types || []).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth++
      setIsDraggingOver(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
    }
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) setIsDraggingOver(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth = 0
      setIsDraggingOver(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) setDroppedFile(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
    { to: '/documents', label: 'Documents', icon: <DocumentsIcon /> },
    { to: '/inbox', label: 'Inbox', icon: <InboxIcon /> },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: `${theme.surface}dd`,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group" style={{ textDecoration: 'none' }}>
            <LogoMark />
            <span className="text-xl font-extrabold tracking-tight gradient-text select-none">
              Vaulty
            </span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {navItems.map(item => {
              const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={
                    active
                      ? { background: `${theme.accent}22`, color: theme.accent }
                      : { color: theme.text2 }
                  }
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <Footer onShowShortcuts={() => setShowShortcuts(true)} />

      {isDraggingOver && !droppedFile && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          style={{ background: `${theme.accent}22`, backdropFilter: 'blur(2px)' }}
        >
          <div
            className="px-8 py-6 rounded-2xl border-2 border-dashed shadow-xl text-center"
            style={{ borderColor: theme.accent, background: theme.surface, color: theme.text }}
          >
            <div className="text-3xl mb-2">📥</div>
            <div className="text-base font-semibold">Drop file to upload</div>
            <div className="text-xs mt-1" style={{ color: theme.text2 }}>
              Metadata will be auto-filled
            </div>
          </div>
        </div>
      )}

      {droppedFile && (
        <UploadModal
          initialFile={droppedFile}
          onClose={() => setDroppedFile(null)}
          onSuccess={() => {
            refresh()
            setDroppedFile(null)
          }}
        />
      )}

      {keySequence.length === 1 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="px-4 py-2 rounded-lg shadow-lg border text-sm font-mono flex items-center gap-2" style={{ backgroundColor: theme.surface, borderColor: theme.accent, color: theme.text }}>
            <span style={{ color: theme.text2 }}>Navigate:</span>
            <kbd className="px-2 py-0.5 rounded border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>g</kbd>
            <span style={{ color: theme.text2 }}>→</span>
            <span className="text-xs" style={{ color: theme.text2 }}>d=Documents, h=Home, i=Inbox, s=Settings</span>
          </div>
        </div>
      )}

      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  )
}
