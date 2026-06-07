import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useDocuments } from '@/contexts/DocumentsContext';
import { Button, Input, Surface } from '@/components/ui';
import { getFileIcon, parseTags } from '@/utils/fileUtils';
import { UploadModal } from '@/components/UploadModal';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useQuery } from '@tanstack/react-query';

const PlusIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);
const SearchIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);
const CloseIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);
const FolderIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M2 5.5A2.5 2.5 0 014.5 3h3.1a2 2 0 011.4.57l1.04 1.02c.19.19.44.29.71.29h4.75A2.5 2.5 0 0118 7.38V14.5a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 012 14.5v-9z" />
  </svg>
);
const StarIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12l-2.8-2.03c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z" />
  </svg>
);
const DatabaseIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M3 4.5C3 3.12 6.13 2 10 2s7 1.12 7 2.5v3C17 8.88 13.87 10 10 10S3 8.88 3 7.5v-3z" />
    <path d="M3 7.5v3C3 11.88 6.13 13 10 13s7-1.12 7-2.5v-3c0 1.38-3.13 2.5-7 2.5S3 8.88 3 7.5z" />
    <path d="M3 10.5v3C3 14.88 6.13 16 10 16s7-1.12 7-2.5v-3c0 1.38-3.13 2.5-7 2.5S3 11.88 3 10.5z" />
  </svg>
);
const InboxIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M4.16 4.2A2 2 0 016.08 3h7.84a2 2 0 011.92 1.2l2 5A2 2 0 0118 9.94V15a2 2 0 01-2 2H4a2 2 0 01-2-2V9.94c0-.25.05-.5.16-.74l2-5zM6.08 5l-1.6 4H7.5a1 1 0 01.9.55l.45.9h2.3l.45-.9a1 1 0 01.9-.55h3.02l-1.6-4H6.08z" clipRule="evenodd" />
  </svg>
);
const ClipboardIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M8 2a2 2 0 00-2 2H5a2 2 0 00-2 2v9a3 3 0 003 3h8a3 3 0 003-3V6a2 2 0 00-2-2h-1a2 2 0 00-2-2H8zm0 2h4v1H8V4zm-1 6.75A.75.75 0 017.75 10h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017 10.75zm0 3A.75.75 0 017.75 13h3.5a.75.75 0 010 1.5h-3.5A.75.75 0 017 13.75z" clipRule="evenodd" />
  </svg>
);

export const FrontPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { docs, loading, refresh } = useDocuments();
  const { recentlyViewed, clearRecentlyViewed, removeStaleItems } = useRecentlyViewed();
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { data: dashboardSignals, refetch: refreshDashboardSignals } = useQuery({
    queryKey: ['vault-dashboard-signals'],
    queryFn: async () => {
      const [missing, duplicates, storage] = await Promise.allSettled([
        api.checkMissingDocuments(),
        api.getDuplicates(),
        api.getStorageStats(),
      ]);

      return {
        missingDocs: missing.status === 'fulfilled' && missing.value?.missing ? missing.value.missing : [],
        duplicateGroups: duplicates.status === 'fulfilled' ? duplicates.value : {},
        storageStats: storage.status === 'fulfilled' ? storage.value : null,
      };
    },
  });
  const missingDocs = dashboardSignals?.missingDocs ?? [];
  const duplicateGroups = dashboardSignals?.duplicateGroups ?? {};
  const storageStats = dashboardSignals?.storageStats ?? null;

  const stats = useMemo(() => {
    const parseTags = (raw?: string): string[] => {
      if (!raw) return [];
      try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
    };
    return {
      total: docs.length,
      inbox: docs.filter((d) => parseTags(d.tags).length === 0).length,
      favorites: docs.filter((d) => d.favorite).length,
    };
  }, [docs]);

  const sortedDocs = useMemo(() => {
    return [...docs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [docs]);

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return docs.filter(d =>
      d.title?.toLowerCase().includes(q) ||
      parseTags(d.tags).some((t: string) => t.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [docs, search]);

  const allMatchingDocs = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return docs.filter(d =>
      d.title?.toLowerCase().includes(q) ||
      parseTags(d.tags).some((t: string) => t.toLowerCase().includes(q))
    );
  }, [docs, search]);

  useEffect(() => {
    if (!loading && docs.length >= 0) {
      removeStaleItems(new Set(docs.map(d => d.id)));
    }
  }, [docs, loading, removeStaleItems]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const statCards = [
    { label: 'Total', sub: 'All documents', display: String(stats.total), to: '/documents', icon: <FolderIcon /> },
    { label: 'Favorites', sub: 'Starred', display: String(stats.favorites), to: '/documents?favorite=true', icon: <StarIcon /> },
    { label: 'Inbox', sub: 'Needs action', display: String(stats.inbox), to: '/inbox', icon: <InboxIcon /> },
    { label: 'Total size', sub: 'Vault storage used', display: storageStats ? formatBytes(storageStats.totalSize) : '—', to: '/settings', icon: <DatabaseIcon /> },
  ];

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">Dashboard</h1>
          {!loading && (
            <p className="text-sm mt-0.5 text-text2">
              {stats.total} {stats.total === 1 ? 'document' : 'documents'} in your vault.
            </p>
          )}
        </div>
        <Button variant="primary" size="lg" leadingIcon={<PlusIcon />} onClick={() => setIsUploading(true)}>
          New document
        </Button>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text2">
            <SearchIcon />
          </span>
          <Input
            className="pl-10 pr-10"
            placeholder="Search documents, categories, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-text2 hover:opacity-70"
              aria-label="Clear search"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {search.trim() && filteredDocs.length > 0 && (
          <div className="space-y-2">
            {allMatchingDocs.length > filteredDocs.length && (
              <div className="flex items-center justify-between text-xs px-3 py-1 text-text2">
                <span>Showing {filteredDocs.length} of {allMatchingDocs.length} results</span>
                <button
                  onClick={() => { navigate(`/documents?search=${encodeURIComponent(search)}`); setSearch(''); }}
                  className="font-medium hover:underline"
                  style={{ color: theme.accent }}
                >
                  View all -&gt;
                </button>
              </div>
            )}
            {filteredDocs.map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
                onClick={() => { navigate(`/documents/${doc.id}`); setSearch(''); }}
              >
                <div>
                  <div className="text-sm font-medium text-text">{doc.title}</div>
                  <div className="text-xs text-text2">{doc.documentDate || 'No date'}</div>
                </div>
                <span className="text-xs text-text2">-&gt;</span>
              </div>
            ))}
          </div>
        )}

        {search.trim() && filteredDocs.length === 0 && !loading && (
          <Surface className="p-4 text-center text-text2 text-sm">
            No documents match "{search}".
          </Surface>
        )}
      </div>

      {!search.trim() && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {statCards.map(card => (
              <Surface
                key={card.label}
                className="p-4 card-hover cursor-pointer"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(card.to)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase text-text2">{card.label}</div>
                  <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                    <span className="scale-75">{card.icon}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold mt-2 text-text">{card.display}</div>
                <div className="text-xs mt-0.5 text-text2">{card.sub}</div>
              </Surface>
            ))}
          </div>

          {(missingDocs.length > 0 || Object.keys(duplicateGroups).length > 0) && (
            <Surface className="p-6 mb-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: '#dc262618', color: '#dc2626' }}>
                  <ClipboardIcon />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text">Vault health</h2>
                  <p className="text-xs text-text2">Issues detected in your vault.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {missingDocs.length > 0 && (
                  <button
                    onClick={() => navigate('/documents')}
                    className="flex items-center justify-between p-4 rounded-xl transition-opacity hover:opacity-90 text-left"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                  >
                    <div>
                      <div className="text-sm font-semibold text-text">Missing files</div>
                      <div className="text-xs text-text2">{missingDocs.length} indexed document{missingDocs.length !== 1 ? 's' : ''} not found on disk.</div>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>View -&gt;</span>
                  </button>
                )}
                {Object.keys(duplicateGroups).length > 0 && (
                  <button
                    onClick={() => navigate('/documents?duplicates=true')}
                    className="flex items-center justify-between p-4 rounded-xl transition-opacity hover:opacity-90 text-left"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                  >
                    <div>
                      <div className="text-sm font-semibold text-text">Duplicate files</div>
                      <div className="text-xs text-text2">{Object.keys(duplicateGroups).length} duplicate group{Object.keys(duplicateGroups).length !== 1 ? 's' : ''} detected.</div>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>View -&gt;</span>
                  </button>
                )}
              </div>
            </Surface>
          )}


          {recentlyViewed.length > 0 && (
            <Surface className="p-6 mb-5">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-base font-bold text-text">Recently viewed</h2>
                <button
                  onClick={clearRecentlyViewed}
                  className="text-xs font-medium underline text-text2 hover:opacity-80"
                >
                  Clear
                </button>
              </div>
              <p className="text-xs mb-5 text-text2">Your recently opened documents.</p>
              <ul className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                {recentlyViewed.map((item, idx) => (
                  <li
                    key={`${item.id}-${idx}`}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer border-b last:border-0 transition-opacity hover:opacity-90"
                    style={{ borderColor: theme.border, background: theme.surface }}
                    onClick={() => navigate(`/documents/${item.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base" aria-hidden="true">{getFileIcon(item.storedFilename)}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-text">{item.title}</div>
                      </div>
                    </div>
                    <span className="text-xs text-text2">-&gt;</span>
                  </li>
                ))}
              </ul>
            </Surface>
          )}

          <Surface className="p-6 mb-5">
            <h2 className="text-base font-bold mb-1 text-text">Recent documents</h2>
            <p className="text-xs mb-5 text-text2">Latest additions to your vault.</p>
            {loading ? (
              <ul className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                {[...Array(5)].map((_, i) => (
                  <li key={i} className="flex items-center justify-between px-4 py-3 border-b last:border-0" style={{ borderColor: theme.border, background: theme.surface }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="skeleton h-5 w-5 rounded" />
                      <div className="skeleton h-4 w-40" />
                    </div>
                    <div className="skeleton h-4 w-20" />
                  </li>
                ))}
              </ul>
            ) : sortedDocs.length === 0 ? (
              <div className="rounded-xl px-4 py-12 text-center text-text2 text-sm" style={{ border: `1px solid ${theme.border}` }}>
                Your vault is empty. Upload your first document to get started.
              </div>
            ) : (
              <ul className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                {sortedDocs.slice(0, 5).map(doc => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer border-b last:border-0 transition-opacity hover:opacity-90"
                    style={{ borderColor: theme.border, background: theme.surface }}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base" aria-hidden="true">{getFileIcon(doc.storedFilename)}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-text">{doc.title}</div>
                        {doc.documentDate && <div className="text-xs text-text2">{doc.documentDate}</div>}
                      </div>
                    </div>
                    <span className="text-xs text-text2">-&gt;</span>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </>
      )}

      {isUploading && (
        <UploadModal
          onClose={() => setIsUploading(false)}
          onSuccess={async () => {
            await refresh();
            await refreshDashboardSignals();
          }}
        />
      )}
    </div>
  );
};
