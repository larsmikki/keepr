import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useDocuments } from '@/contexts/DocumentsContext';
import { Button, Surface, useToast } from '@/components/ui';
import { useNavigate } from 'react-router-dom';
import { getFileIcon } from '@/utils/fileUtils';
import { api } from '@/api';
import { TagInput } from '@/components/TagInput';
import type { Document } from '@/types';

function parseTags(raw?: string): string[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
}

interface EditState { title: string; tags: string[]; }
interface LogEntry { type: 'info' | 'success' | 'error' | 'summary'; text: string; }

export const InboxPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { docs, updateDocument } = useDocuments();
  const { addToast } = useToast();
  const { data: aiSettings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const { data: allTags = [] } = useQuery({ queryKey: ['tags'], queryFn: api.getTags });
  const aiConfigured = !!aiSettings?.ai_provider && aiSettings.ai_provider !== 'none';
  const [aiSuggestingId, setAiSuggestingId] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [suggestingAll, setSuggestingAll] = useState(false);
  const [suggestAllLog, setSuggestAllLog] = useState<LogEntry[]>([]);
  const [suggestProgress, setSuggestProgress] = useState<{ done: number; total: number } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const inboxDocs = useMemo(() => {
    const filtered = docs.filter(d => parseTags(d.tags).length === 0);
    return [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [docs]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [suggestAllLog]);

  const appendLog = (entry: LogEntry) => setSuggestAllLog(prev => [...prev, entry]);

  const getEditState = (doc: Document): EditState =>
    editStates[doc.id] ?? { title: doc.title || '', tags: parseTags(doc.tags) };

  const setField = (id: string, patch: Partial<EditState>, doc: Document) => {
    setEditStates(prev => ({ ...prev, [id]: { ...getEditState(doc), ...prev[id], ...patch } }));
  };

  const handleAiSuggest = async (doc: Document) => {
    setAiSuggestingId(doc.id);
    setAiErrors(prev => { const n = { ...prev }; delete n[doc.id]; return n; });
    try {
      const suggestion = await api.suggestDocumentMetadataWithAi(doc.id);
      setEditStates(prev => {
        const current = prev[doc.id] ?? { title: doc.title || '', tags: parseTags(doc.tags) };
        return { ...prev, [doc.id]: { title: suggestion.title || current.title, tags: suggestion.tags?.length ? suggestion.tags : current.tags } };
      });
      const parts: string[] = [];
      if (suggestion.title) parts.push(`Title: "${suggestion.title}"`);
      if (suggestion.tags?.length) parts.push(`Tags: ${suggestion.tags.join(', ')}`);
      addToast(parts.length > 0 ? parts.join(' · ') : 'AI returned no suggestions', parts.length > 0 ? 'success' : 'info');
    } catch (err: any) {
      setAiErrors(prev => ({ ...prev, [doc.id]: err.message || 'AI suggestion failed' }));
    } finally {
      setAiSuggestingId(null);
    }
  };

  const handleSave = async (doc: Document) => {
    const state = getEditState(doc);
    setSavingId(doc.id);
    try {
      await updateDocument(doc.id, { title: state.title, tags: JSON.stringify(state.tags) });
      setEditStates(prev => { const n = { ...prev }; delete n[doc.id]; return n; });
      addToast('Saved', 'success');
    } catch (err: any) {
      addToast('Failed to save: ' + (err.message || err), 'error');
    } finally { setSavingId(null); }
  };

  const handleSuggestAllWithAi = async () => {
    if (!inboxDocs.length) return;
    const docsToSuggest = [...inboxDocs];
    setSuggestingAll(true);
    setSuggestAllLog([{ type: 'info', text: `Suggesting metadata for ${docsToSuggest.length} document${docsToSuggest.length === 1 ? '' : 's'}…` }]);
    setSuggestProgress({ done: 0, total: docsToSuggest.length });

    let ok = 0, fail = 0;
    for (let i = 0; i < docsToSuggest.length; i++) {
      const doc = docsToSuggest[i];
      setSuggestProgress({ done: i, total: docsToSuggest.length });
      try {
        const suggestion = await api.suggestDocumentMetadataWithAi(doc.id);
        setEditStates(prev => {
          const current = prev[doc.id] ?? { title: doc.title || '', tags: parseTags(doc.tags) };
          return { ...prev, [doc.id]: { title: suggestion.title || current.title, tags: suggestion.tags?.length ? suggestion.tags : current.tags } };
        });
        ok++;
        appendLog({ type: 'success', text: `${suggestion.title || doc.title || doc.id}  [${suggestion.tags?.join(', ') || '—'}]` });
      } catch (err: any) {
        fail++;
        setAiErrors(prev => ({ ...prev, [doc.id]: err.message || 'AI suggestion failed' }));
        appendLog({ type: 'error', text: `${doc.title || doc.id} — ${err.message || 'failed'}` });
      }
    }

    setSuggestProgress({ done: docsToSuggest.length, total: docsToSuggest.length });
    appendLog({ type: 'summary', text: fail === 0 ? `Done — ${ok} suggestion${ok === 1 ? '' : 's'} ready.` : `Done — ${ok} suggested, ${fail} failed.` });
    setSuggestingAll(false);
  };

  const logColor = (type: LogEntry['type']): string => {
    if (type === 'success') return '#16a34a';
    if (type === 'error') return '#dc2626';
    if (type === 'summary') return theme.accent;
    return theme.text2;
  };

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">Inbox</h1>
          <p className="text-sm mt-0.5 text-text2">Documents with no tags.</p>
        </div>
        {inboxDocs.length > 0 && (
          <Button variant="primary" size="sm" onClick={handleSuggestAllWithAi} disabled={suggestingAll || !aiConfigured}
            title={!aiConfigured ? 'Configure an AI provider in Settings first' : undefined}>
            {suggestingAll ? 'Suggesting…' : 'Suggest with AI for All'}
          </Button>
        )}
      </div>

      {/* Progress panel */}
      {suggestProgress !== null && (
        <Surface className="p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text">
              {suggestingAll ? `Processing ${suggestProgress.done + 1} of ${suggestProgress.total}…` : 'AI suggestions ready'}
            </span>
            {!suggestingAll && (
              <button onClick={() => { setSuggestAllLog([]); setSuggestProgress(null); }} className="text-xs text-text2 hover:text-text">Dismiss</button>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full mb-3" style={{ background: theme.surface2 }}>
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${suggestProgress.total > 0 ? (suggestProgress.done / suggestProgress.total) * 100 : 0}%`, background: theme.accent }}
            />
          </div>
          <div className="rounded-lg p-3 font-mono text-xs overflow-y-auto max-h-44 flex flex-col gap-0.5" style={{ background: theme.surface2 }}>
            {suggestAllLog.map((entry, i) => (
              <div key={i} style={{ color: logColor(entry.type) }}>
                {entry.type === 'success' ? '✓ ' : entry.type === 'error' ? '✗ ' : '  '}{entry.text}
              </div>
            ))}
            {suggestingAll && <div style={{ color: theme.text2 }} className="animate-pulse">…</div>}
            <div ref={logEndRef} />
          </div>
        </Surface>
      )}

      {inboxDocs.length === 0 ? (
        <Surface className="p-6 mb-5 text-center py-20">
          <h2 className="text-base font-bold mb-1 text-text">Your inbox is empty</h2>
          <p className="text-xs text-text2">All your documents have tags.</p>
        </Surface>
      ) : (
        <Surface className="p-6 mb-5">
          <h2 className="text-base font-bold mb-1 text-text">Untagged documents</h2>
          <p className="text-xs mb-5 text-text2">
            {inboxDocs.length} document{inboxDocs.length === 1 ? '' : 's'} without tags. Edit title and tags below, or use AI to suggest them.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {inboxDocs.map(doc => {
              const isSaving = savingId === doc.id;
              const isAiSuggesting = aiSuggestingId === doc.id;
              const aiError = aiErrors[doc.id];
              const state = getEditState(doc);
              return (
                <div key={doc.id} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="w-10 h-10 rounded flex items-center justify-center text-lg flex-shrink-0 mt-1" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                    {getFileIcon(doc.storedFilename)}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <input
                      type="text"
                      value={state.title}
                      onChange={e => setField(doc.id, { title: e.target.value }, doc)}
                      disabled={isSaving}
                      placeholder="Document title…"
                      className="w-full px-2.5 py-1.5 rounded-lg text-sm font-medium text-text bg-transparent outline-none border placeholder:text-text2 focus:ring-1"
                      style={{ borderColor: theme.border, background: theme.surface }}
                    />
                    <TagInput
                      tags={state.tags}
                      onChange={tags => setField(doc.id, { tags }, doc)}
                      suggestions={allTags}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button
                      disabled={isSaving || isAiSuggesting || !aiConfigured}
                      onClick={() => handleAiSuggest(doc)}
                      title={!aiConfigured ? 'Configure an AI provider in Settings first' : undefined}
                      className="text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ background: `${theme.accent}18`, color: theme.accent, border: `1px solid ${theme.accent}35` }}
                    >
                      {isAiSuggesting ? 'Analyzing…' : <><span>✦</span><span>Suggest with AI</span></>}
                    </button>
                    {aiError && <p className="text-xs max-w-[200px] text-right leading-snug break-words" style={{ color: '#dc2626' }} title={aiError}>{aiError}</p>}
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/documents/${doc.id}`)} className="text-xs text-text2 hover:text-text px-1" title="Open document">↗</button>
                      <Button variant="primary" size="sm" disabled={isSaving || isAiSuggesting} onClick={() => handleSave(doc)}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
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
