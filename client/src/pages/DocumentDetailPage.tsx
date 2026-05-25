import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input, Select, Surface, Textarea, useToast } from '@/components/ui';
import { api } from '@/api';
import type { Document } from '@/types';
import { getFileIcon } from '@/utils/fileUtils';
import { CATEGORIES, DOCUMENT_TYPES } from '@/constants';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
  </svg>
);

const FIELDS = ['tags'] as const;
type TagField = typeof FIELDS[number];

export const DocumentDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const { addRecentlyViewed } = useRecentlyViewed();
  const [doc, setDoc] = useState<Document | { error: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [pendingTag, setPendingTag] = useState<{ type: TagField; value: string } | null>(null);

  const fetchDoc = async () => {
    try {
      const data = await api.getDocument(id!);
      setDoc(data);
      addRecentlyViewed({ id: data.id, title: data.title, storedFilename: data.storedFilename, category: data.category });
      setEditForm({
        title: data.title,
        category: data.category || 'Other',
        documentType: data.documentType || '',
        description: data.description || '',
        notes: data.notes || '',
        documentDate: data.documentDate || '',
        amount: data.amount ?? '',
        currency: data.currency || 'DKK',
        tags: JSON.parse(data.tags || '[]'),
      });
    } catch (err: any) {
      console.error('Failed to fetch document', err);
      setDoc({ error: err.message || 'Failed to load document' });
    }
  };

  useEffect(() => { fetchDoc(); }, [id]);

  const handleSave = async () => {
    try {
      await api.updateDocumentMetadata(id!, editForm);
      await fetchDoc();
      setIsEditing(false);
      addToast('Saved', 'success');
    } catch (err: any) {
      addToast('Save failed: ' + (err.message || err), 'error');
    }
  };

  const toggleFavorite = async () => {
    if (!document) return;
    try {
      const next = document.favorite ? 0 : 1;
      await api.updateDocumentMetadata(id!, { favorite: next });
      setDoc({ ...document, favorite: next });
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  const addTag = (type: TagField) => setPendingTag({ type, value: '' });

  const commitTag = () => {
    if (pendingTag && pendingTag.value.trim()) {
      setEditForm({
        ...editForm,
        [pendingTag.type]: [...(editForm[pendingTag.type] || []), pendingTag.value.trim()],
      });
    }
    setPendingTag(null);
  };

  const removeTag = (type: TagField, index: number) => {
    const list = [...editForm[type]];
    list.splice(index, 1);
    setEditForm({ ...editForm, [type]: list });
  };

  if (!doc) return <div className="p-4 text-text">Loading...</div>;

  if ('error' in doc) return (
    <div className="max-w-4xl mx-auto w-full p-8 text-center">
      <h2 className="text-xl font-bold mb-2 text-text">Document not found</h2>
      <p className="text-text2">{(doc as { error: string }).error}</p>
      <div className="mt-4">
        <Button variant="primary" onClick={() => navigate('/documents')}>Back to documents</Button>
      </div>
    </div>
  );

  const document = doc as Document;

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-text truncate">
            {isEditing ? (
              <Input
                className="!py-1.5"
                value={editForm.title}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
              />
            ) : document.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFavorite}
            className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: document.favorite ? '#f59e0b' : theme.text2 }}
            title={document.favorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={document.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <StarIcon filled={!!document.favorite} />
          </button>
          <Button
            variant="primary"
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          >
            {isEditing ? 'Save changes' : 'Edit metadata'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          <Surface className="p-6">
            <h2 className="text-base font-bold mb-1 text-text">Preview</h2>
            <p className="text-xs mb-5 text-text2">Document content.</p>
            {(() => {
              const ext = document.storedFilename?.split('.').pop()?.toLowerCase() || '';
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
              const isPdf = ext === 'pdf';
              const fileUrl = `/api/documents/file/${document.id}`;
              const previewUrl = `/api/preview/${document.id}`;

              if (isImage) {
                return <img src={fileUrl} alt={document.title} className="max-h-[740px] w-auto mx-auto rounded-lg" />;
              }
              if (isPdf) {
                return <iframe src={`${fileUrl}#toolbar=0&navpanes=0`} className="w-full h-[740px] rounded-lg" title={document.title} />;
              }
              if (ext) {
                return <iframe src={previewUrl} className="w-full h-[740px] rounded-lg" title={document.title} />;
              }
              return (
                <div
                  className="aspect-video rounded-lg flex flex-col items-center justify-center border-2 border-dashed"
                  style={{ borderColor: theme.border, background: theme.surface2 }}
                >
                  <span className="text-4xl mb-2" aria-hidden="true">{getFileIcon(document.storedFilename)}</span>
                  <span className="text-text2">Preview not available for this file type.</span>
                  <span className="text-xs mt-2 text-text2">.{ext} file</span>
                </div>
              );
            })()}
          </Surface>

          <Surface className="p-6">
            <h2 className="text-base font-bold mb-1 text-text">Details</h2>
            <p className="text-xs mb-5 text-text2">Structured metadata.</p>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <DetailField label="Category">
                {isEditing ? (
                  <Select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </Select>
                ) : <span className="text-text">{document.category || 'Uncategorized'}</span>}
              </DetailField>
              <DetailField label="Document type">
                {isEditing ? (
                  <Select value={editForm.documentType} onChange={e => setEditForm({ ...editForm, documentType: e.target.value })}>
                    <option value="">Not set</option>
                    {DOCUMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </Select>
                ) : <span className="text-text">{document.documentType || 'Not set'}</span>}
              </DetailField>
              <DetailField label="Document date">
                {isEditing ? (
                  <Input type="date" value={editForm.documentDate} onChange={e => setEditForm({ ...editForm, documentDate: e.target.value })} />
                ) : <span className="text-text">{document.documentDate || '-'}</span>}
              </DetailField>
              <DetailField label="Amount">
                {isEditing ? (
                  <Input type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} placeholder="0.00" />
                ) : <span className="text-text">{document.amount != null ? `${document.amount} ${document.currency || 'DKK'}` : '-'}</span>}
              </DetailField>
              <DetailField label="Currency">
                {isEditing ? (
                  <Select value={editForm.currency} onChange={e => setEditForm({ ...editForm, currency: e.target.value })}>
                    {['DKK', 'EUR', 'USD', 'GBP', 'SEK', 'NOK'].map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                ) : <span className="text-text">{document.currency || 'DKK'}</span>}
              </DetailField>

              <div className="col-span-2 space-y-4">
                {FIELDS.map(field => {
                  const items: string[] = isEditing
                    ? editForm[field] || []
                    : JSON.parse((document[field as keyof Document] as string) || '[]');
                  const labels: Record<TagField, string> = { tags: 'Tags' };
                  return (
                    <div key={field}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-text2">{labels[field]}</span>
                        {isEditing && pendingTag?.type !== field && (
                          <button onClick={() => addTag(field)} className="text-xs font-semibold" style={{ color: theme.accent }}>+ Add</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {items.map((item: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 text-text"
                            style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                          >
                            {item}
                            {isEditing && (
                              <button onClick={() => removeTag(field, idx)} className="text-text2 hover:opacity-70" aria-label={`Remove ${item}`}>x</button>
                            )}
                          </span>
                        ))}
                        {isEditing && pendingTag?.type === field && (
                          <div className="flex items-center gap-1">
                            <Input
                              autoFocus
                              className="!py-1 !px-2 !w-32 text-xs"
                              value={pendingTag.value}
                              onChange={e => setPendingTag({ ...pendingTag, value: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); commitTag(); }
                                if (e.key === 'Escape') setPendingTag(null);
                              }}
                              onBlur={() => { if (!pendingTag.value.trim()) setPendingTag(null); }}
                            />
                            <button onClick={commitTag} className="text-sm font-bold" style={{ color: theme.accent }} aria-label="Confirm">OK</button>
                            <button onClick={() => setPendingTag(null)} className="text-sm text-text2" aria-label="Cancel">x</button>
                          </div>
                        )}
                        {!isEditing && items.length === 0 && (
                          <span className="text-xs italic text-text2">None assigned</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="col-span-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-2">Description</span>
                {isEditing ? (
                  <Textarea
                    rows={3}
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  />
                ) : <span className="text-text">{document.description || 'No description provided.'}</span>}
              </div>

              <div className="col-span-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-2">Notes</span>
                {isEditing ? (
                  <Textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                ) : <span className="text-text">{document.notes || 'No notes provided.'}</span>}
              </div>
            </div>
          </Surface>
        </div>

        <div className="space-y-5">
          <Surface className="p-6">
            <h2 className="text-base font-bold mb-1 text-text">File info</h2>
            <p className="text-xs mb-5 text-text2">System data.</p>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-text2">Size</span>
                <span className="text-text">{document.fileSize ? `${(document.fileSize / 1024).toFixed(2)} KB` : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text2">Checksum</span>
                <span className="truncate max-w-[120px] text-text">
                  {document.checksum ? `${document.checksum.split(':')[1]?.substring(0, 8)}...` : '-'}
                </span>
              </div>
              {document.filePath && (
                <div className="pt-3 border-t" style={{ borderColor: theme.border }}>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text2 block mb-2">File path</span>
                  <div className="flex items-center gap-2">
                    <code
                      className="flex-1 px-2 py-1.5 rounded text-[10px] truncate block max-w-[180px] text-text"
                      style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                      title={document.filePath}
                    >
                      {document.filePath}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (document.filePath) {
                          navigator.clipboard.writeText(document.filePath);
                          addToast('Path copied', 'success');
                        }
                      }}
                      title="Copy path"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
              <div className="pt-3 border-t flex gap-2" style={{ borderColor: theme.border }}>
                <Button variant="primary" fullWidth onClick={() => window.open(`/api/documents/file/${document.id}`)}>
                  Open
                </Button>
                <Button
                  fullWidth
                  onClick={() => {
                    const link = window.document.createElement('a');
                    link.href = `/api/documents/file/${document.id}`;
                    link.download = document.storedFilename || 'document';
                    link.click();
                  }}
                >
                  Download
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
