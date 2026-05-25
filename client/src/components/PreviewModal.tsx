import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface PreviewModalProps {
  documentId: string;
  title: string;
  filename: string;
  onClose: () => void;
  documentIds?: string[];
  currentIndex?: number;
  onNavigate?: (docId: string, index: number) => void;
}

// Lightbox-style modal — deliberate deviation from the standard Modal primitive
// (darker backdrop, custom layout, prev/next navigation).
// See design-system/README.md §10 "lightbox-style image viewers go darker".
export const PreviewModal: React.FC<PreviewModalProps> = ({
  documentId, title, filename, onClose, documentIds, currentIndex = 0, onNavigate,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);

  const hasNext = documentIds && currentIndex < documentIds.length - 1;
  const hasPrev = documentIds && currentIndex > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext && onNavigate) {
        onNavigate(documentIds![currentIndex + 1], currentIndex + 1);
      }
      if (e.key === 'ArrowLeft' && hasPrev && onNavigate) {
        onNavigate(documentIds![currentIndex - 1], currentIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasNext, hasPrev, onNavigate, documentIds, currentIndex]);

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isText = ['txt', 'md', 'html', 'json', 'xml', 'csv'].includes(ext);

  useEffect(() => {
    if (isText && !isImage && !isPdf) {
      fetch(`/api/preview/${documentId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load preview');
          return res.text();
        })
        .then(text => { setContent(text); setLoading(false); })
        .catch(err => { setError(err.message); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [documentId, isText, isImage, isPdf]);

  const previewUrl = `/api/preview/${documentId}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.40)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: `1px solid ${theme.border}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {hasPrev && (
              <button
                onClick={() => onNavigate?.(documentIds![currentIndex - 1], currentIndex - 1)}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-70 text-text2"
                title="Previous (←)"
                aria-label="Previous document"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <span className="font-semibold truncate text-text">{title}</span>
            <span
              className="text-xs px-2 py-0.5 rounded text-text2"
              style={{ background: theme.surface2 }}
            >
              {ext.toUpperCase()}
            </span>
            {documentIds && (
              <span className="text-xs text-text2">{currentIndex + 1} / {documentIds.length}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasNext && (
              <button
                onClick={() => onNavigate?.(documentIds![currentIndex + 1], currentIndex + 1)}
                className="p-2 rounded-lg transition-opacity hover:opacity-70 text-text2"
                title="Next (→)"
                aria-label="Next document"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-opacity hover:opacity-70 text-text2"
              aria-label="Close"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto" style={{ background: theme.surface2 }}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div
                className="rounded-full border-2 border-t-transparent animate-spin"
                style={{ width: 32, height: 32, borderColor: `${theme.accent} transparent ${theme.accent} ${theme.accent}` }}
              />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="font-medium" style={{ color: '#dc2626' }}>{error}</div>
            </div>
          ) : isImage ? (
            <img src={previewUrl} alt={title} className="max-w-full max-h-[80vh] mx-auto object-contain" />
          ) : isPdf ? (
            <iframe src={previewUrl} className="w-full h-[75vh]" title={title} />
          ) : isText && content !== null ? (
            <pre className="p-6 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-[75vh] text-text">
              {content}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-text2">
              <div>Preview not available for this file type.</div>
              <div className="text-xs mt-1">Supported: PDF, images, text, Markdown.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
