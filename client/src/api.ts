import type { Document, RescanResult, ImportResult, PaginatedResponse, MetadataSuggestion, AiSettings, AiMetadataSuggestion, DocumentHistoryEntry, LinkedDocument } from '@/types';

const BASE = '/api';

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Request timed out');
    throw new Error(`Could not reach the Documentr server at ${window.location.origin} — it may have crashed or restarted`);
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try { const data = JSON.parse(text) as { error?: string }; message = data.error || text; } catch {}
    throw new Error(message || res.statusText);
  }
  return res.json();
}

export interface FilterPreset {
  id?: number;
  name: string;
  search?: string;
  favorite?: boolean;
  archived?: boolean;
  dateFrom?: string;
  dateTo?: string;
  tag?: string;
  fileSizeMin?: number;
  fileSizeMax?: number;
  noMetadata?: boolean;
  sortBy?: string;
  sortDir?: string;
}

export const api = {
  getMetadataSuggestions: (filename: string) =>
    fetchJson<MetadataSuggestion>(`/metadata/suggest?filename=${encodeURIComponent(filename)}`),

  getDocuments: (params?: {
    limit?: number; offset?: number; search?: string; sortBy?: string; sortDir?: string;
    favorite?: boolean; archived?: boolean; dateFrom?: string; dateTo?: string; tag?: string;
    folder?: string; fileSizeMin?: number; fileSizeMax?: number; noMetadata?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortDir) query.set('sortDir', params.sortDir);
    if (params?.favorite !== undefined) query.set('favorite', String(params.favorite));
    if (params?.archived !== undefined) query.set('archived', String(params.archived));
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.folder) query.set('folder', params.folder);
    if (params?.fileSizeMin !== undefined) query.set('fileSizeMin', String(params.fileSizeMin));
    if (params?.fileSizeMax !== undefined) query.set('fileSizeMax', String(params.fileSizeMax));
    if (params?.noMetadata !== undefined) query.set('noMetadata', String(params.noMetadata));
    const url = '/documents' + (query.toString() ? `?${query.toString()}` : '');
    return fetchJson<PaginatedResponse<Document> | Document[]>(url);
  },

  getAllDocuments: () => fetchJson<Document[]>('/documents'),

  getTags: () => fetchJson<string[]>('/documents/tags'),

  getFolders: () => fetchJson<string[]>('/documents/folders'),

  getDocumentActivity: (months = 12) =>
    fetchJson<Array<{ month: string; count: number; totalSize: number }>>(`/documents/activity?months=${months}`),

  getDuplicates: () => fetchJson<Record<string, Document[]>>('/documents/duplicates'),

  checkMissingDocuments: () =>
    fetchJson<{ missing: Array<{ id: string; title: string; filePath: string }>; orphanedSidecars: Array<{ id: string; title: string; sidecarPath: string }> }>('/documents/check-missing'),

  getDocument: (id: string) => fetchJson<Document>(`/documents/${id}`),

  reextractText: (id: string) =>
    fetchJson<{ success: boolean; message: string }>(`/documents/${id}/reextract`, { method: 'POST' }),

  updateDocument: (id: string, updates: Partial<Document>) =>
    fetchJson<{ success: boolean }>(`/metadata/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  deleteDocument: (id: string) =>
    fetchJson<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' }),

  updateDocumentMetadata: (id: string, updates: Partial<Document>) =>
    fetchJson<{ success: boolean }>(`/metadata/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  bulkUpdateDocuments: (ids: string[], updates: Partial<Document>) =>
    fetchJson<{ success: boolean; updatedCount: number }>('/bulk', {
      method: 'PATCH', body: JSON.stringify({ ids, updates }),
    }),

  bulkDeleteDocuments: (ids: string[]) =>
    fetchJson<{ success: boolean; deletedCount: number }>('/bulk', {
      method: 'DELETE', body: JSON.stringify({ ids }),
    }),

  uploadDocuments: (files: File[], metadata: Record<string, any>): Promise<{ results: Array<{ documentId: string; filePath: string; filename: string; duplicate?: boolean; existingDocumentId?: string; error?: string }> }> => {
    const form = new FormData();
    files.forEach(file => form.append('files', file));
    form.append('metadata', JSON.stringify(metadata));
    form.append('fileLastModified', JSON.stringify(files.map(f => f.lastModified)));
    return fetch(`${BASE}/documents/upload-batch`, { method: 'POST', body: form }).then(async r => {
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    });
  },

  importFolder: (folderPath: string) =>
    fetchJson<ImportResult>('/import/import-folder', { method: 'POST', body: JSON.stringify({ folderPath }) }),

  rescan: (deleteMissing = false, importNew = false) =>
    fetchJson<RescanResult>('/rescan/run', { method: 'POST', body: JSON.stringify({ deleteMissing, importNew }), headers: { 'Content-Type': 'application/json' } }),

  getConfig: () => fetchJson<{ vaultRoot: string; port: number }>('/config'),

  getSettings: () => fetchJson<AiSettings>('/settings'),

  getStorageStats: () =>
    fetchJson<{ totalDocuments: number; totalSize: number; diskUsage: { used: number; free: number; total: number } }>('/settings/storage-stats'),

  updateSettings: (updates: AiSettings) =>
    fetchJson<AiSettings>('/settings', { method: 'PUT', body: JSON.stringify(updates) }),

  getLocalAiModels: (ollamaUrl?: string) => {
    const query = ollamaUrl?.trim() ? `?url=${encodeURIComponent(ollamaUrl.trim())}` : '';
    return fetchJson<{ models: string[]; error?: string }>(`/ai/local-models${query}`);
  },

  testAiConnection: () =>
    fetchJson<{ ok: true; provider: string; model: string; message: string }>('/ai/test'),

  suggestDocumentMetadataWithAi: (id: string) =>
    fetchJson<AiMetadataSuggestion>(`/ai/documents/${id}/suggest-metadata`, { method: 'POST', body: JSON.stringify({}) }),

  bulkSuggestMetadataWithAi: (ids: string[]) =>
    fetchJson<{ results: Array<{ id: string; success: boolean; suggestion?: AiMetadataSuggestion; error?: string }> }>('/ai/bulk-suggest-metadata', {
      method: 'POST', body: JSON.stringify({ documentIds: ids }),
    }),

  downloadDocument: async (id: string, filename: string) => {
    const res = await fetch(`${BASE}/export/download/${id}`);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  },

  exportBatchDocuments: async (ids: string[], includeSidecars = true) => {
    const res = await fetch(`${BASE}/export/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, includeSidecars }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `documentr-export-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  },

  exportCsvIndex: async () => {
    const res = await fetch(`${BASE}/export/csv`);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `documentr-index-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  },

  getFilterPresets: () => fetchJson<FilterPreset[]>('/filter-presets'),

  saveFilterPreset: (preset: FilterPreset) =>
    fetchJson<{ id: number; name: string }>('/filter-presets', { method: 'POST', body: JSON.stringify(preset) }),

  deleteFilterPreset: (id: number) =>
    fetchJson<{ success: boolean }>(`/filter-presets/${id}`, { method: 'DELETE' }),

  // Document history
  getDocumentHistory: (id: string) =>
    fetchJson<DocumentHistoryEntry[]>(`/history/${id}`),

  // Document links
  getDocumentLinks: (id: string) =>
    fetchJson<LinkedDocument[]>(`/links/${id}`),

  addDocumentLink: (from_id: string, to_id: string) =>
    fetchJson<{ success: boolean }>('/links', { method: 'POST', body: JSON.stringify({ from_id, to_id }) }),

  removeDocumentLink: (from_id: string, to_id: string) =>
    fetchJson<{ success: boolean }>('/links', { method: 'DELETE', body: JSON.stringify({ from_id, to_id }) }),

  // Full-text search
  searchDocuments: (q: string) =>
    fetchJson<Document[]>(`/search/search?q=${encodeURIComponent(q)}`),
};
