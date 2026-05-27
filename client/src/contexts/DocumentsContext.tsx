import { createContext, useContext } from 'react';
import type { Document } from '@/types';

export type { Document };

export interface DocumentsContextType {
  docs: Document[];
  loading: boolean;
  refresh: () => Promise<void>;
  addDocument: (doc: Partial<Document>) => Promise<void>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export const documentsQueryKey = ['documents'] as const;

export const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

export const useDocuments = () => {
  const context = useContext(DocumentsContext);
  if (!context) throw new Error('useDocuments must be used within a DocumentsProvider');
  return context;
};
