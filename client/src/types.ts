export interface Document {
  id: string;
  title: string;
  description?: string;
  documentDate?: string;
  tags?: string;
  notes?: string;
  originalFilename?: string;
  storedFilename?: string;
  filePath?: string;
  sidecarPath?: string;
  checksum?: string;
  fileSize?: number;
  favorite?: number;
  archived?: number;
  folder?: string;
  fileModifiedDate?: string;
  extractedText?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentHistoryEntry {
  id: number;
  document_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface LinkedDocument {
  id: string;
  title: string;
  storedFilename?: string;
  documentDate?: string;
  fileSize?: number;
}

export interface RescanResult {
  newFiles: string[];
  missingFiles: string[];
  movedFiles: string[];
  checksumMismatches: string[];
  sidecarConflicts: string[];
  deletedFromDb: string[];
  importedNewFiles: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  message: string;
}

export interface PaginatedResponse<T> {
  documents: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MetadataSuggestion {
  title?: string;
  documentDate?: string;
}

export interface AiSettings {
  ai_provider?: 'none' | 'openai' | 'ollama';
  ai_openai_model?: string;
  ai_ollama_model?: string;
  ai_api_key?: string;
  ai_base_url?: string;
  ai_ollama_url?: string;
  ai_temperature?: string;
}

export interface AiMetadataSuggestion {
  title?: string;
  tags?: string[];
  confidence?: number;
  reason?: string;
}

export interface Settings extends AiSettings {
  folder_organization?: 'year-month' | 'flat';
}
