import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useDocuments } from '@/contexts/DocumentsContext';
import { Surface } from '@/components/ui';
import { getFileIcon, getFileTypeLabel, parseTags } from '@/utils/fileUtils';

const formatSize = (bytes?: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FavoritesPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { docs, loading } = useDocuments();

  const favorites = docs.filter(d => d.favorite);

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-text">Favorites</h1>
        <p className="text-sm mt-0.5 text-text2">
          {favorites.length} starred {favorites.length === 1 ? 'document' : 'documents'}
        </p>
      </div>

      {loading ? (
        <Surface className="p-6">
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg" style={{ background: theme.surface2 }} />
            ))}
          </div>
        </Surface>
      ) : favorites.length === 0 ? (
        <Surface className="p-12 text-center">
          <div className="text-4xl mb-3">⭐</div>
          <h2 className="text-base font-bold text-text mb-1">No favorites yet</h2>
          <p className="text-sm text-text2">
            Star a document from the detail page to add it here.
          </p>
        </Surface>
      ) : (
        <Surface className="overflow-hidden">
          <ul>
            {favorites.map(doc => {
              const tags = parseTags(doc.tags);
              return (
                <li
                  key={doc.id}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-opacity hover:opacity-90 border-b last:border-0"
                  style={{ borderColor: theme.border, background: theme.surface }}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  <span className="text-xl shrink-0" aria-hidden="true">{getFileIcon(doc.storedFilename)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text truncate">{doc.title}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-text2">
                      <span>{getFileTypeLabel(doc.storedFilename)} · {formatSize(doc.fileSize)}</span>
                      {doc.documentDate && <span>·</span>}
                      {doc.documentDate && <span>{doc.documentDate}</span>}
                      {tags.length > 0 && <span>·</span>}
                      {tags.slice(0, 3).map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${theme.accent}18`, color: theme.accent }}>{t}</span>
                      ))}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-text2 mt-1 truncate">{doc.description}</p>
                    )}
                  </div>
                  <span className="text-text2 text-xs shrink-0">→</span>
                </li>
              );
            })}
          </ul>
        </Surface>
      )}
    </div>
  );
};
