import React, { useMemo, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useDocuments } from '@/contexts/DocumentsContext';
import { Button, Select, Surface, useToast } from '@/components/ui';
import { useNavigate } from 'react-router-dom';
import { getFileIcon } from '@/utils/fileUtils';
import { CATEGORIES, DOCUMENT_TYPES } from '@/constants';
import { api } from '@/api';
import type { AiMetadataSuggestion } from '@/types';

export const InboxPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { docs, updateDocument } = useDocuments();
  const { addToast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<'category' | 'documentType'>('category');
  const [aiSuggestingId, setAiSuggestingId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiMetadataSuggestion>>({});
  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAiLoading, setBulkAiLoading] = useState(false);
  const [bulkApplyLoading, setBulkApplyLoading] = useState(false);
  const [autoFiling, setAutoFiling] = useState(false);
  const [autoFileProgress, setAutoFileProgress] = useState<{ done: number; total: number } | null>(null);

  const inboxDocs = useMemo(() => {
    const filtered = docs.filter((d) => !d.category || !d.documentType || d.documentType === 'Unspecified');
    return [...filtered].sort((a, b) => {
      if (sortBy === 'title') {
        const cmp = (a.title || '').localeCompare(b.title || '');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortDir === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [docs, sortBy, sortDir]);

  const handleQuickUpdate = async (id: string, field: 'category' | 'documentType', value: string) => {
    if (!value) return;
    setSavingId(id);
    setSavingType(field);
    try {
      await updateDocument(id, { [field]: value });
      setAiSuggestions(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      addToast(field === 'category' ? 'Filed' : 'Type updated', 'success');
    } catch (err: any) {
      addToast('Failed to update: ' + (err.message || err), 'error');
    } finally {
      setSavingId(null);
      setSavingType('category');
    }
  };

  const handleAiSuggest = async (id: string) => {
    setAiSuggestingId(id);
    try {
      const suggestion = await api.suggestDocumentMetadataWithAi(id);
      setAiSuggestions(prev => ({ ...prev, [id]: suggestion }));
      addToast('AI suggestion ready', 'success');
    } catch (err: any) {
      addToast(err.message || 'AI suggestion failed', 'error');
    } finally {
      setAiSuggestingId(null);
    }
  };

  const handleApplyAiSuggestion = async (id: string) => {
    const suggestion = aiSuggestions[id];
    if (!suggestion) return;
    setSavingId(id);
    setSavingType('category');
    try {
      await updateDocument(id, {
        category: suggestion.category,
        documentType: suggestion.documentType,
      });
      setAiSuggestions(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      addToast('AI suggestion applied', 'success');
    } catch (err: any) {
      addToast('Failed to apply AI suggestion: ' + (err.message || err), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleBulkAiSuggest = async () => {
    if (selectedIds.size === 0) return;
    setBulkAiLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await api.bulkSuggestMetadataWithAi(ids);
      const newSuggestions: Record<string, AiMetadataSuggestion> = {};
      let successCount = 0;
      for (const r of result.results) {
        if (r.success && r.suggestion) {
          newSuggestions[r.id] = r.suggestion;
          successCount++;
        }
      }
      setAiSuggestions(prev => ({ ...prev, ...newSuggestions }));
      addToast(`AI suggestions ready for ${successCount} document${successCount === 1 ? '' : 's'}`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Bulk AI failed', 'error');
    } finally {
      setBulkAiLoading(false);
    }
  };

  const handleApplyAllSuggestions = async () => {
    const docsWithSuggestions = inboxDocs.filter(d => aiSuggestions[d.id]);
    if (docsWithSuggestions.length === 0) return;
    setBulkApplyLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const doc of docsWithSuggestions) {
      const suggestion = aiSuggestions[doc.id];
      try {
        await updateDocument(doc.id, {
          category: suggestion.category,
          documentType: suggestion.documentType,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) {
      setAiSuggestions({});
      addToast(`Applied ${successCount} suggestion${successCount === 1 ? '' : 's'}${failCount > 0 ? `, ${failCount} failed` : ''}`, failCount > 0 ? 'error' : 'success');
    } else {
      addToast('Failed to apply suggestions', 'error');
    }
    setBulkApplyLoading(false);
  };

  const handleAutoFileAllWithAi = async () => {
    if (inboxDocs.length === 0) return;
    const batchSize = 10;
    const docsToFile = [...inboxDocs];
    setAutoFiling(true);
    setAutoFileProgress({ done: 0, total: docsToFile.length });
    try {
      let successCount = 0;
      let failCount = 0;
      const remainingSuggestions: Record<string, AiMetadataSuggestion> = {};

      for (let i = 0; i < docsToFile.length; i += batchSize) {
        const batch = docsToFile.slice(i, i + batchSize);
        const result = await api.bulkSuggestMetadataWithAi(batch.map(doc => doc.id));

        for (const item of result.results) {
          if (!item.success || !item.suggestion) {
            failCount++;
            continue;
          }

          try {
            await updateDocument(item.id, {
              category: item.suggestion.category,
              documentType: item.suggestion.documentType,
            });
            successCount++;
          } catch {
            failCount++;
            remainingSuggestions[item.id] = item.suggestion;
          }
        }

        setAutoFileProgress({ done: Math.min(i + batch.length, docsToFile.length), total: docsToFile.length });
      }

      setAiSuggestions(remainingSuggestions);
      setSelectedIds(new Set());
      addToast(
        `Auto-filed ${successCount} document${successCount === 1 ? '' : 's'}${failCount > 0 ? `, ${failCount} failed` : ''}`,
        failCount > 0 ? 'error' : 'success'
      );
    } catch (err: any) {
      addToast(err.message || 'Auto-file with AI failed', 'error');
    } finally {
      setAutoFiling(false);
      setAutoFileProgress(null);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === inboxDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(inboxDocs.map(d => d.id)));
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">Inbox</h1>
          <p className="text-sm mt-0.5 text-text2">Documents with no category or type.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text2">Sort by</span>
          <Select
            className="!w-auto !py-1.5"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'title')}
          >
            <option value="createdAt">Date added</option>
            <option value="title">Title</option>
          </Select>
          <Button
            size="sm"
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Oldest first' : 'Newest first'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      {inboxDocs.length > 0 && (
        <Surface className="p-4 mb-5 flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={selectedIds.size === inboxDocs.length && inboxDocs.length > 0}
              onChange={toggleSelectAll}
            />
            <span className="text-base font-bold text-text">{selectedIds.size} selected</span>
          </label>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleAutoFileAllWithAi} disabled={autoFiling || bulkAiLoading || bulkApplyLoading}>
              {autoFiling && autoFileProgress
                ? `Auto-filing ${autoFileProgress.done}/${autoFileProgress.total}`
                : 'Auto-file all with AI'}
            </Button>
            {Object.keys(aiSuggestions).length > 0 && (
              <Button variant="primary" size="sm" onClick={handleApplyAllSuggestions} disabled={bulkApplyLoading}>
                {bulkApplyLoading ? 'Applying…' : `Apply all (${Object.keys(aiSuggestions).length})`}
              </Button>
            )}
            <Button size="sm" onClick={handleBulkAiSuggest} disabled={bulkAiLoading || autoFiling || selectedIds.size === 0}>
              {bulkAiLoading ? 'Analyzing…' : 'AI suggest'}
            </Button>
          </div>
        </Surface>
      )}

      {inboxDocs.length === 0 ? (
        <Surface className="p-6 mb-5 text-center py-20">
          <h2 className="text-base font-bold mb-1 text-text">Your inbox is empty</h2>
          <p className="text-xs text-text2">All your documents are organized.</p>
        </Surface>
      ) : (
        <Surface className="p-6 mb-5">
          <h2 className="text-base font-bold mb-1 text-text">Unsorted documents</h2>
          <p className="text-xs mb-5 text-text2">
            You have {inboxDocs.length} document{inboxDocs.length === 1 ? '' : 's'} to organize. Pick values manually, or ask AI to preselect a category and type.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {inboxDocs.map(doc => {
              const isSaving = savingId === doc.id;
              const aiSuggestion = aiSuggestions[doc.id];
              const isAiSuggesting = aiSuggestingId === doc.id;
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                >
                  <input
                    type="checkbox"
                    className="rounded mr-3"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer"
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
                      aria-hidden="true"
                    >
                      {getFileIcon(doc.storedFilename)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate text-text">{doc.title}</div>
                      <div className="text-xs text-text2">
                        Added {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'unknown'}
                        {aiSuggestion?.reason ? ` · ${aiSuggestion.reason}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <Select
                      className="!w-auto !py-1.5 text-xs"
                      value={aiSuggestion?.category || ''}
                      disabled={isSaving || isAiSuggesting}
                      onChange={(e) => handleQuickUpdate(doc.id, 'category', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Category for ${doc.title}`}
                    >
                      <option value="" disabled>
                        {isSaving && savingType !== 'documentType' ? 'Saving…' : 'Category'}
                      </option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </Select>
                    <Select
                      className="!w-auto !py-1.5 text-xs"
                      value={aiSuggestion?.documentType || ''}
                      disabled={isSaving || isAiSuggesting}
                      onChange={(e) => handleQuickUpdate(doc.id, 'documentType', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Type for ${doc.title}`}
                    >
                      <option value="" disabled>
                        {isSaving && savingType !== 'category' ? 'Saving…' : 'Type'}
                      </option>
                      {DOCUMENT_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </Select>
                    {aiSuggestion ? (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isSaving}
                        onClick={(e) => { e.stopPropagation(); handleApplyAiSuggestion(doc.id); }}
                        title={aiSuggestion.reason}
                      >
                        Apply AI
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isSaving || isAiSuggesting}
                        onClick={(e) => { e.stopPropagation(); handleAiSuggest(doc.id); }}
                      >
                        {isAiSuggesting ? 'Thinking…' : 'Suggest'}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/documents/${doc.id}`)}>
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Surface>
      )}
    </div>
  );
};
