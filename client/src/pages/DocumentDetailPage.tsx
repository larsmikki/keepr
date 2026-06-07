import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input, Surface, Textarea, useToast } from '@/components/ui';
import { api } from '@/api';
import type { Document } from '@/types';
import { getFileIcon, getFileTypeLabel, parseTags } from '@/utils/fileUtils';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { TagInput } from '@/components/TagInput';
import { ShortcutBus } from '@/components/Layout';

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

type EditForm = {
  title: string;
  description: string;
  notes: string;
  documentDate: string;
  tags: string[];
  folder: string;
};

const createEditForm = (document: Document): EditForm => ({
  title: document.title,
  description: document.description || '',
  notes: document.notes || '',
  documentDate: document.documentDate || '',
  tags: parseTags(document.tags),
  folder: document.folder || '',
});

export const DocumentDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const { addRecentlyViewed } = useRecentlyViewed();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EditForm>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'links'>('details');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<Document[]>([]);
  const [reextracting, setReextracting] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoState, setUndoState] = useState<EditForm | null>(null);

  const documentQueryKey = ['document-detail', id] as const;
  const { data: doc = null, error } = useQuery({
    queryKey: documentQueryKey,
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  const { data: allTags = [] } = useQuery({ queryKey: ['tags'], queryFn: api.getTags });
  const { data: history = [] } = useQuery({
    queryKey: ['history', id],
    queryFn: () => api.getDocumentHistory(id!),
    enabled: !!id && activeTab === 'history',
  });
  const { data: links = [], refetch: refetchLinks } = useQuery({
    queryKey: ['links', id],
    queryFn: () => api.getDocumentLinks(id!),
    enabled: !!id && activeTab === 'links',
  });

  const loadedEditForm = useMemo(() => doc ? createEditForm(doc) : null, [doc]);
  const form = { ...(loadedEditForm ?? {}), ...editForm } as EditForm;

  useEffect(() => {
    if (!doc) return;
    addRecentlyViewed({ id: doc.id, title: doc.title, storedFilename: doc.storedFilename });
  }, [addRecentlyViewed, doc]);

  // Wire up 'f' shortcut to toggle favorite on this page
  useEffect(() => {
    return ShortcutBus.on('toggle-favorite', () => { if (doc) toggleFavorite(); });
  }, [doc]);

  const handleSave = async () => {
    if (!doc) return;
    const snapshot = createEditForm(doc);
    try {
      const payload: Partial<Document> = {
        ...form,
        tags: JSON.stringify(form.tags ?? []),
      };
      await api.updateDocumentMetadata(id!, payload);
      await queryClient.invalidateQueries({ queryKey: documentQueryKey });
      setEditForm({});
      setIsEditing(false);

      // Offer undo for 8 seconds
      setUndoState(snapshot);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoState(null), 8000);

      addToast('Saved', 'success');
    } catch (err: any) {
      addToast('Save failed: ' + (err.message || err), 'error');
    }
  };

  const handleUndo = async () => {
    if (!undoState) return;
    try {
      await api.updateDocumentMetadata(id!, {
        ...undoState,
        tags: JSON.stringify(undoState.tags),
      });
      await queryClient.invalidateQueries({ queryKey: documentQueryKey });
      setUndoState(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      addToast('Changes undone', 'success');
    } catch {
      addToast('Undo failed', 'error');
    }
  };

  const toggleFavorite = async () => {
    if (!doc) return;
    try {
      const next = doc.favorite ? 0 : 1;
      await api.updateDocumentMetadata(id!, { favorite: next });
      queryClient.setQueryData<Document>(documentQueryKey, { ...doc, favorite: next });
    } catch (err) { console.error('Failed to toggle favorite', err); }
  };

  const searchLinks = async (q: string) => {
    if (!q.trim()) { setLinkSearchResults([]); return; }
    try {
      const results = await api.searchDocuments(q);
      setLinkSearchResults(results.filter(r => r.id !== id && !links.find(l => l.id === r.id)).slice(0, 8));
    } catch {}
  };

  const addLink = async (toId: string) => {
    if (!id) return;
    await api.addDocumentLink(id, toId);
    refetchLinks();
    setLinkSearch('');
    setLinkSearchResults([]);
  };

  const removeLink = async (toId: string) => {
    if (!id) return;
    await api.removeDocumentLink(id, toId);
    refetchLinks();
  };

  const handleReextract = async () => {
    if (!id) return;
    setReextracting(true);
    try {
      await api.reextractText(id);
      addToast('Text extraction started — search index will update shortly', 'success');
    } catch (err: any) {
      addToast('Re-extraction failed: ' + err.message, 'error');
    } finally {
      setReextracting(false);
    }
  };

  if (!doc && !error) return <div className="p-4 text-text">Loading…</div>;
  if (error || !doc) return (
    <div className="max-w-4xl mx-auto w-full p-8 text-center">
      <h2 className="text-xl font-bold mb-2 text-text">Document not found</h2>
      <p className="text-text2">{error instanceof Error ? error.message : 'Failed to load document'}</p>
      <div className="mt-4"><Button variant="primary" onClick={() => navigate('/documents')}>Back to documents</Button></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Undo toast */}
      {undoState && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm"
          style={{ background: theme.surface, borderColor: theme.accent, color: theme.text }}
        >
          <span>Metadata saved.</span>
          <button
            onClick={handleUndo}
            className="font-semibold underline underline-offset-2"
            style={{ color: theme.accent }}
          >
            Undo
          </button>
          <button onClick={() => setUndoState(null)} className="text-text2 hover:text-text ml-1">×</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-text truncate">
            {isEditing ? (
              <Input className="!py-1.5" value={form.title} onChange={e => setEditForm({ ...form, title: e.target.value })} />
            ) : doc.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFavorite}
            className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: doc.favorite ? '#f59e0b' : theme.text2 }}
            title={doc.favorite ? 'Remove from favorites (F)' : 'Add to favorites (F)'}
          >
            <StarIcon filled={!!doc.favorite} />
          </button>
          <Button variant="primary" onClick={() => isEditing ? handleSave() : setIsEditing(true)}>
            {isEditing ? 'Save changes' : 'Edit metadata'}
          </Button>
          {isEditing && (
            <Button onClick={() => { setIsEditing(false); setEditForm({}); }}>Cancel</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          {/* Preview */}
          <Surface className="p-6">
            <h2 className="text-base font-bold mb-1 text-text">Preview</h2>
            <p className="text-xs mb-5 text-text2">Document content.</p>
            {(() => {
              const ext = doc.storedFilename?.split('.').pop()?.toLowerCase() || '';
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
              const isPdf = ext === 'pdf';
              const isTextPreview = ['txt', 'md', 'docx', 'xlsx', 'xls', 'xlsb', 'xlsm', 'ods', 'csv', 'json', 'xml', 'yaml', 'yml', 'log'].includes(ext);
              const fileUrl = `/api/documents/file/${doc.id}`;
              if (isImage) return <img src={fileUrl} alt={doc.title} className="max-h-[740px] w-auto mx-auto rounded-lg" />;
              if (isPdf) return <iframe src={`${fileUrl}#toolbar=0&navpanes=0`} className="w-full h-[740px] rounded-lg" title={doc.title} />;
              if (isTextPreview) return <iframe src={`/api/preview/${doc.id}`} className="w-full h-[740px] rounded-lg" title={doc.title} />;
              return (
                <div className="py-14 rounded-lg flex flex-col items-center justify-center border-2 border-dashed gap-3" style={{ borderColor: theme.border, background: theme.surface2 }}>
                  <span className="text-5xl" aria-hidden="true">{getFileIcon(doc.storedFilename)}</span>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text">No preview available</p>
                    <p className="text-xs mt-1 text-text2">{ext ? `.${ext.toUpperCase()} files cannot be previewed` : 'Unknown file type'}</p>
                  </div>
                  <button className="mt-1 text-xs font-semibold underline" style={{ color: theme.accent }} onClick={() => window.open(fileUrl)}>Open in browser</button>
                </div>
              );
            })()}
          </Surface>

          {/* Tabs: Details / History / Links */}
          <Surface className="p-6">
            <div className="flex gap-4 border-b mb-5" style={{ borderColor: theme.border }}>
              {(['details', 'history', 'links'] as const).map(tab => (
                <button
                  key={tab}
                  className="pb-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px"
                  style={{
                    borderColor: activeTab === tab ? theme.accent : 'transparent',
                    color: activeTab === tab ? theme.accent : theme.text2,
                  }}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}{tab === 'history' && history.length > 0 ? ` (${history.length})` : ''}
                  {tab === 'links' && links.length > 0 ? ` (${links.length})` : ''}
                </button>
              ))}
            </div>

            {activeTab === 'details' && (
              <div className="space-y-4 text-sm">
                <DetailField label="Document date">
                  {isEditing ? (
                    <Input type="date" value={form.documentDate} onChange={e => setEditForm({ ...form, documentDate: e.target.value })} />
                  ) : <span className="text-text">{doc.documentDate || '-'}</span>}
                </DetailField>

                <DetailField label="Folder / Project">
                  {isEditing ? (
                    <Input value={form.folder} onChange={e => setEditForm({ ...form, folder: e.target.value })} placeholder="e.g. Tax 2025, Work, Personal" />
                  ) : <span className="text-text">{doc.folder || '-'}</span>}
                </DetailField>

                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-2">Tags</span>
                  {isEditing ? (
                    <TagInput
                      tags={form.tags ?? []}
                      onChange={tags => setEditForm({ ...form, tags })}
                      suggestions={allTags}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {parseTags(doc.tags).map(t => (
                        <span key={t} className="px-2.5 py-1 rounded-full text-xs font-medium text-text" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>{t}</span>
                      ))}
                      {parseTags(doc.tags).length === 0 && <span className="text-xs italic text-text2">None assigned</span>}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-2">Description</span>
                  {isEditing ? (
                    <Textarea rows={3} value={form.description} onChange={e => setEditForm({ ...form, description: e.target.value })} />
                  ) : <span className="text-text">{doc.description || 'No description provided.'}</span>}
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-2">Notes</span>
                  {isEditing ? (
                    <Textarea rows={3} value={form.notes} onChange={e => setEditForm({ ...form, notes: e.target.value })} />
                  ) : <span className="text-text">{doc.notes || 'No notes provided.'}</span>}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-2">
                {history.length === 0 ? (
                  <p className="text-sm text-text2 italic">No metadata changes recorded yet.</p>
                ) : history.map(entry => (
                  <div key={entry.id} className="text-xs p-3 rounded-lg" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-text capitalize">{entry.field}</span>
                      <span className="text-text2">{new Date(entry.changed_at).toLocaleString()}</span>
                    </div>
                    {entry.old_value && <div className="text-text2 line-through truncate">{entry.old_value}</div>}
                    <div className="text-text truncate">{entry.new_value ?? <em>cleared</em>}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'links' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-2">Link to another document</label>
                  <div className="relative">
                    <Input
                      value={linkSearch}
                      onChange={e => { setLinkSearch(e.target.value); searchLinks(e.target.value); }}
                      placeholder="Search documents to link…"
                    />
                    {linkSearchResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden" style={{ background: theme.surface, borderColor: theme.border }}>
                        {linkSearchResults.map(r => (
                          <button
                            key={r.id}
                            className="w-full text-left px-3 py-2 text-sm hover:opacity-80 flex items-center gap-2"
                            style={{ color: theme.text }}
                            onClick={() => addLink(r.id)}
                          >
                            <span>{getFileIcon(r.storedFilename)}</span>
                            <span className="truncate">{r.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {links.length === 0 ? (
                  <p className="text-sm text-text2 italic">No linked documents yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {links.map(link => (
                      <li key={link.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                        <span className="text-lg">{getFileIcon(link.storedFilename)}</span>
                        <button className="flex-1 text-left text-sm font-medium text-text hover:underline truncate" onClick={() => navigate(`/documents/${link.id}`)}>
                          {link.title}
                        </button>
                        <span className="text-xs text-text2">{getFileTypeLabel(link.storedFilename)}</span>
                        <button onClick={() => removeLink(link.id)} className="text-text2 hover:text-text text-xs" title="Remove link">×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Surface>
        </div>

        {/* File info sidebar */}
        <div className="space-y-5">
          <Surface className="p-6">
            <h2 className="text-base font-bold mb-4 text-text">File info</h2>
            <div className="space-y-3 text-xs">
              {doc.originalFilename && (
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-1">Original filename</span>
                  <span className="text-text break-all">{doc.originalFilename}</span>
                </div>
              )}
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-1">Type</span>
                <span className="text-text">{getFileTypeLabel(doc.storedFilename)}</span>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-1">Size</span>
                <span className="text-text">{doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : '-'}</span>
              </div>
              {doc.checksum && (
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-1">Checksum</span>
                  <code className="text-[11px] text-text" title={doc.checksum}>{doc.checksum.split(':')[1]?.substring(0, 12) ?? doc.checksum.substring(0, 12)}…</code>
                </div>
              )}
              {doc.fileModifiedDate && (
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-1">File modified</span>
                  <span className="text-text">{doc.fileModifiedDate}</span>
                </div>
              )}
              {doc.createdAt && (
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-1">Added</span>
                  <span className="text-text">{new Date(doc.createdAt).toLocaleString()}</span>
                </div>
              )}
              {doc.updatedAt && (
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-1">Last updated</span>
                  <span className="text-text">{new Date(doc.updatedAt).toLocaleString()}</span>
                </div>
              )}
              {doc.filePath && (
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-1.5">File path</span>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                    <code className="flex-1 text-[10px] text-text break-all leading-relaxed">{doc.filePath}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(doc.filePath!); addToast('Path copied', 'success'); }}
                      className="shrink-0 p-1 rounded hover:opacity-70 text-text2"
                      title="Copy path"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <rect x="7" y="7" width="10" height="11" rx="1.5" />
                        <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-8A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              <div className="pt-2 flex gap-2">
                <Button variant="primary" fullWidth onClick={() => window.open(`/api/documents/file/${doc.id}`)}>Open</Button>
                <Button fullWidth onClick={() => {
                  const link = window.document.createElement('a');
                  link.href = `/api/documents/file/${doc.id}`;
                  link.download = doc.storedFilename || 'document';
                  link.click();
                }}>Download</Button>
              </div>

              {/* OCR / extracted text status */}
              <div className="pt-2 border-t" style={{ borderColor: theme.border }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2">Search text</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      background: doc.extractedText ? `${theme.accent}20` : `${theme.surface2}`,
                      color: doc.extractedText ? theme.accent : theme.text2,
                    }}>
                    {doc.extractedText ? `${doc.extractedText.length.toLocaleString()} chars` : 'Not indexed'}
                  </span>
                </div>
                <Button
                  fullWidth
                  onClick={handleReextract}
                  disabled={reextracting}
                >
                  {reextracting ? 'Extracting…' : doc.extractedText ? 'Re-extract text' : 'Extract text (OCR)'}
                </Button>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wider font-semibold text-text2 mb-1">{label}</span>
      {children}
    </div>
  );
}
