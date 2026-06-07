import { Modal } from '@/components/ui';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['/'], description: 'Focus search input' },
  { keys: ['n'], description: 'Open upload modal' },
  { keys: ['f'], description: 'Toggle favorite (on document page)' },
  { keys: ['Esc'], description: 'Clear filters / Close modal' },
];

const navigationShortcuts = [
  { keys: ['g then d'], description: 'Go to Documents' },
  { keys: ['g then h'], description: 'Go to Dashboard (Home)' },
  { keys: ['g then f'], description: 'Go to Favorites' },
  { keys: ['g then i'], description: 'Go to Inbox' },
  { keys: ['g then s'], description: 'Go to Settings' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 text-xs font-mono rounded-md border bg-bg border-border text-text">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="Keyboard shortcuts" maxWidth="480px">
      <div className="space-y-5">
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-text2 mb-3">General</h3>
          <div className="space-y-2">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-text">{s.description}</span>
                <Kbd>{s.keys[0]}</Kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-text2 mb-3">Global navigation (vim-style)</h3>
          <div className="space-y-2">
            {navigationShortcuts.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-text">{s.description}</span>
                <Kbd>{s.keys[0]}</Kbd>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-text2">
          Press <Kbd>?</Kbd> to toggle this help
        </p>
      </div>
    </Modal>
  );
}
