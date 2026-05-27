import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import type { Document, PaginatedResponse } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, ConfirmDialog, Input, Select, useToast } from '@/components/ui';
import { UploadModal } from '@/components/UploadModal';
import { getFileIcon } from '@/utils/fileUtils';
import { CATEGORIES, DOCUMENT_TYPES } from '@/constants';

type SortField = 'createdAt' | 'updatedAt' | 'documentDate' | 'title' | 'category' | 'documentType' | 'amount' | 'fileSize';
const EMPTY_DOCS: Document[] = [];

const TrashIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5h5m-7.75 2h10.5m-9.5 0 .6 9.1a1 1 0 0 0 1 .9h5.3a1 1 0 0 0 1-.9l.6-9.1M8.5 8.75v5m3-5v5M8 4.5l.45-1h3.1l.45 1" />
  </svg>
);

export const DocumentsPage: React.FC = () => {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showUpload, setShowUpload] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const documentParams = useMemo(() => ({
    search: search || undefined,
    category: category || undefined,
    documentType: documentType || undefined,
    sortBy,
    sortDir,
  }), [category, documentType, search, sortBy, sortDir]);
  const { data: documentData, isLoading: loading } = useQuery({
    queryKey: ['documents-page', documentParams],
    queryFn: async () => {
      const result = await api.getDocuments(documentParams);
      if (Array.isArray(result)) return { docs: result, total: result.length };
      const paged = result as PaginatedResponse<Document>;
      return { docs: paged.documents, total: paged.total };
    },
  });
  const docs = documentData?.docs ?? EMPTY_DOCS;
  const totalDocs = documentData?.total ?? 0;
  const refreshDocuments = () => queryClient.invalidateQueries({ queryKey: ['documents-page'] });

  const visibleIds = useMemo(() => docs.map(doc => doc.id), [docs]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const deleteDocument = async () => {
    if (!deleteId) return;
    try {
      await api.deleteDocument(deleteId);
      addToast('Document deleted', 'success');
      setDeleteId(null);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
      void refreshDocuments();
    } catch (err) {
      addToast('Delete failed: ' + err, 'error');
    }
  };

  const deleteSelectedDocuments = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await api.bulkDeleteDocuments(ids);
      addToast(`${ids.length} document${ids.length === 1 ? '' : 's'} deleted`, 'success');
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      void refreshDocuments();
    } catch (err) {
      addToast('Bulk delete failed: ' + err, 'error');
    }
  };

  const sortButton = (field: SortField, label: React.ReactNode) => (
    <button
      className="font-semibold hover:opacity-75"
      style={{ color: sortBy === field ? theme.accent : theme.text }}
      onClick={() => {
        setSortBy(field);
        setSortDir(sortBy === field && sortDir === 'asc' ? 'desc' : 'asc');
      }}
    >
      {label} {sortBy === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-text">Documents</h1>
            <p className="text-sm text-text2">{totalDocs} {totalDocs === 1 ? 'document' : 'documents'}</p>
          </div>
          <Button variant="primary" onClick={() => setShowUpload(true)}>Upload</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input className="max-w-sm" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
          <Select className="!w-auto" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select className="!w-auto" value={documentType} onChange={e => setDocumentType(e.target.value)}>
            <option value="">All types</option>
            {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select className="!w-auto" value={sortBy} onChange={e => setSortBy(e.target.value as SortField)}>
            <option value="createdAt">Added</option>
            <option value="updatedAt">Modified</option>
            <option value="documentDate">Document date</option>
            <option value="title">Title</option>
            <option value="category">Category</option>
            <option value="documentType">Type</option>
            <option value="amount">Amount</option>
            <option value="fileSize">Size</option>
          </Select>
          <Button onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}>
            {viewMode === 'table' ? 'Grid' : 'Table'}
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 rounded-xl flex items-center justify-between gap-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <span className="text-sm font-medium text-text">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            <Button size="sm" variant="danger" onClick={() => setBulkDeleteOpen(true)}>Delete selected</Button>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: theme.border, background: theme.surface }}>
          <table className="w-full text-sm text-left">
            <thead style={{ background: theme.surface2 }}>
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all visible documents"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="px-4 py-3">{sortButton('title', 'Title')}</th>
                <th className="px-4 py-3">{sortButton('category', 'Category')}</th>
                <th className="px-4 py-3">{sortButton('documentType', 'Type')}</th>
                <th className="px-4 py-3">{sortButton('documentDate', 'Date')}</th>
                <th className="px-4 py-3">{sortButton('fileSize', 'Size')}</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-text2">Loading...</td></tr>
              ) : docs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-text2">No documents found.</td></tr>
              ) : docs.map(doc => (
                <tr
                  key={doc.id}
                  className="border-t cursor-pointer hover:opacity-90"
                  style={{ borderColor: theme.border }}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${doc.title}`}
                      checked={selectedIds.has(doc.id)}
                      onChange={() => toggleSelected(doc.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-lg" aria-hidden="true">{getFileIcon(doc.storedFilename)}</span>
                      <span className="font-medium text-text">{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text2">{doc.category || 'Uncategorized'}</td>
                  <td className="px-4 py-3 text-text2">{doc.documentType || '-'}</td>
                  <td className="px-4 py-3 text-text2">{doc.documentDate || '-'}</td>
                  <td className="px-4 py-3 text-text2">{formatSize(doc.fileSize)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-opacity hover:opacity-70 focus:outline-none focus:ring-2"
                      style={{ color: '#dc2626' }}
                      onClick={() => setDeleteId(doc.id)}
                      title="Delete document"
                      aria-label={`Delete ${doc.title}`}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="border rounded-xl p-4 cursor-pointer transition-opacity hover:opacity-90 relative"
              style={{ borderColor: theme.border, background: theme.surface }}
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <input
                type="checkbox"
                aria-label={`Select ${doc.title}`}
                className="absolute top-3 left-3"
                checked={selectedIds.has(doc.id)}
                onClick={e => e.stopPropagation()}
                onChange={() => toggleSelected(doc.id)}
              />
              <div className="h-24 flex items-center justify-center text-5xl mb-3" style={{ background: theme.surface2 }}>
                {getFileIcon(doc.storedFilename)}
              </div>
              <div className="font-medium truncate text-text">{doc.title}</div>
              <div className="text-xs mt-1 text-text2">{doc.category || 'Uncategorized'} - {doc.documentType || 'Untyped'}</div>
              <div className="text-xs mt-1 text-text2">{formatSize(doc.fileSize)}</div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            void refreshDocuments();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete document"
        message="This document will be permanently deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={deleteDocument}
        onClose={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected documents"
        message={`${selectedIds.size} document${selectedIds.size === 1 ? '' : 's'} will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={deleteSelectedDocuments}
        onClose={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
};
