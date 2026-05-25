import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '@/api';
import type { Document } from '@/types';

export type { Document };

interface DocumentsContextType {
  docs: Document[];
  loading: boolean;
  refresh: () => Promise<void>;
  addDocument: (doc: Partial<Document>) => Promise<void>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

export const DocumentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDocuments();
      if (Array.isArray(data)) {
        setDocs(data);
      } else {
        setDocs(data.documents);
      }
    } catch (err) {
      console.error('Failed to fetch documents', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const addDocument = useCallback(async (_doc: Partial<Document>) => {
    await fetchDocs();
  }, [fetchDocs]);

  const updateDocument = useCallback(async (id: string, updates: Partial<Document>) => {
    await api.updateDocument(id, updates);
    await fetchDocs();
  }, [fetchDocs]);

  const deleteDocument = useCallback(async (id: string) => {
    await api.deleteDocument(id);
    await fetchDocs();
  }, [fetchDocs]);

  return (
    <DocumentsContext.Provider value={{ docs, loading, refresh: fetchDocs, addDocument, updateDocument, deleteDocument }}>
      {children}
    </DocumentsContext.Provider>
  );
};

export const useDocuments = () => {
  const context = useContext(DocumentsContext);
  if (!context) throw new Error('useDocuments must be used within a DocumentsProvider');
  return context;
};
