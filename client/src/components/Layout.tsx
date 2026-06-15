import React, { useEffect, useState, useCallback } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useDocuments } from '@/contexts/DocumentsContext'
import Footer from '@/components/Footer'
import { UploadModal } from '@/components/UploadModal'
import KeyboardShortcuts from '@/components/KeyboardShortcuts'
import { parseTags } from '@/utils/fileUtils'

const DocumentsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
  </svg>
)
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
  </svg>
)
const InboxIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.16 4.2A2 2 0 016.08 3h7.84a2 2 0 011.92 1.2l2 5A2 2 0 0118 9.94V15a2 2 0 01-2 2H4a2 2 0 01-2-2V9.94c0-.25.05-.5.16-.74l2-5zM6.08 5l-1.6 4H7.5a1 1 0 01.9.55l.45.9h2.3l.45-.9a1 1 0 01.9-.55h3.02l-1.6-4H6.08z" clipRule="evenodd" />
  </svg>
)
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
)
const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
)
const LogoMark = () => (
  <img src="/favicon.svg" width={28} height={28} alt="Documentr" className="shrink-0" />
)

// Broadcast channel for global shortcut events that pages can listen to
export const ShortcutBus = {
  listeners: new Map<string, (() => void)[]>(),
  on(event: string, fn: () => void) {
    const arr = this.listeners.get(event) ?? [];
    arr.push(fn);
    this.listeners.set(event, arr);
    return () => { const a = this.listeners.get(event) ?? []; this.listeners.set(event, a.filter(f => f !== fn)); };
  },
  emit(event: string) {
    (this.listeners.get(event) ?? []).forEach(fn => fn());
  },
};

export default function Layout() {
  const { theme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const { refresh, docs } = useDocuments()
  const inboxCount = docs.filter(d => { const t = parseTags(d.tags); return t.length === 0; }).length
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [keySequence, setKeySequence] = useState<string[]>([])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as Element;
    const inInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.hasAttribute('contenteditable');

    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !inInput) {
      e.preventDefault();
      setShowShortcuts(prev => !prev);
      return;
    }

    if (e.key === 'Escape') {
      setKeySequence([]);
      setShowShortcuts(false);
      setShowUpload(false);
      ShortcutBus.emit('escape');
      return;
    }

    if (inInput) return;

    // vim-style navigation
    if (keySequence.length === 1 && keySequence[0] === 'g') {
      e.preventDefault();
      switch (e.key.toLowerCase()) {
        case 'd': navigate('/documents'); break;
        case 'h': navigate('/'); break;
        case 'i': navigate('/inbox'); break;
        case 's': navigate('/settings'); break;
        case 'f': navigate('/favorites'); break;
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

    // Single-key shortcuts
    switch (e.key) {
      case 'n':
      case 'u':
        e.preventDefault();
        setShowUpload(true);
        break;
      case '/':
        e.preventDefault();
        ShortcutBus.emit('focus-search');
        break;
      case 'f':
        e.preventDefault();
        ShortcutBus.emit('toggle-favorite');
        break;
    }
  }, [keySequence, navigate]);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const onDragOver = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if ((e.target as Element)?.closest('[data-upload-modal]')) return;
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) setDroppedFiles(files);
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  const navItems: { to: string; label: string; icon: React.ReactNode; count?: number }[] = [
    { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
    { to: '/documents', label: 'Documents', icon: <DocumentsIcon /> },
    { to: '/favorites', label: 'Favorites', icon: <StarIcon /> },
    { to: '/inbox', label: 'Inbox', icon: <InboxIcon />, count: inboxCount },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{ background: `${theme.surface}dd`, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group" style={{ textDecoration: 'none' }}>
            <LogoMark />
            <span className="text-xl font-extrabold tracking-tight gradient-text select-none">Documentr</span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {navItems.map(item => {
              const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={active ? { background: `${theme.accent}22`, color: theme.accent } : { color: theme.text2 }}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.count != null && item.count > 0 && (
                    <span
                      className="hidden sm:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none"
                      style={{ background: theme.accent, color: '#fff' }}
                    >
                      {item.count}
                    </span>
                  )}
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

      {(droppedFiles.length > 0 || showUpload) && (
        <UploadModal
          initialFiles={droppedFiles.length > 0 ? droppedFiles : undefined}
          onClose={() => { setDroppedFiles([]); setShowUpload(false); }}
          onSuccess={() => { refresh(); setDroppedFiles([]); setShowUpload(false); }}
        />
      )}

      {keySequence.length === 1 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="px-4 py-2 rounded-lg shadow-lg border text-sm font-mono flex items-center gap-2" style={{ backgroundColor: theme.surface, borderColor: theme.accent, color: theme.text }}>
            <span style={{ color: theme.text2 }}>Navigate:</span>
            <kbd className="px-2 py-0.5 rounded border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>g</kbd>
            <span style={{ color: theme.text2 }}>→</span>
            <span className="text-xs" style={{ color: theme.text2 }}>d=Docs, h=Home, f=Favorites, i=Inbox, s=Settings</span>
          </div>
        </div>
      )}

      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  )
}
