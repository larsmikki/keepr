import { parseTags } from './fileUtils.js';

export interface SidecarData {
  sidecarVersion: number;
  documentId: string;
  title: string;
  description?: string;
  documentDate?: string;
  tags: string[];
  notes?: string;
  folder?: string;
  originalFilename?: string;
  storedFilename?: string;
  checksum?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function buildSidecar(doc: Record<string, any>): SidecarData {
  return {
    sidecarVersion: 1,
    documentId: doc.id,
    title: doc.title,
    description: doc.description ?? undefined,
    documentDate: doc.documentDate ?? undefined,
    tags: parseTags(doc.tags),
    notes: doc.notes ?? undefined,
    folder: doc.folder ?? undefined,
    originalFilename: doc.originalFilename ?? undefined,
    storedFilename: doc.storedFilename ?? undefined,
    checksum: doc.checksum ?? undefined,
    createdAt: doc.createdAt ?? undefined,
    updatedAt: doc.updatedAt ?? undefined,
  };
}
