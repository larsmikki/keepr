import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import type { Document } from '@/types';
import { DocumentsContext, documentsQueryKey } from '@/contexts/DocumentsContext';

async function loadDocuments(): Promise<Document[]> {
  const data = await api.getDocuments();
  return Array.isArray(data) ? data : data.documents;
}

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: documentsQueryKey,
    queryFn: loadDocuments,
  });

  const invalidateDocuments = () => queryClient.invalidateQueries({ queryKey: documentsQueryKey });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Document> }) => api.updateDocument(id, updates),
    onSuccess: invalidateDocuments,
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: invalidateDocuments,
  });

  const refresh = async () => { await invalidateDocuments(); };
  const addDocument = async (_doc: Partial<Document>) => { await invalidateDocuments(); };
  const updateDocument = async (id: string, updates: Partial<Document>) => {
    await updateMutation.mutateAsync({ id, updates });
  };
  const deleteDocument = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  return (
    <DocumentsContext.Provider value={{ docs, loading: isLoading, refresh, addDocument, updateDocument, deleteDocument }}>
      {children}
    </DocumentsContext.Provider>
  );
}
