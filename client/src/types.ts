export interface Document {
  id: string;
  title: string;
  description?: string;
  category?: string;
  documentType?: string;
  amount?: number;
  currency?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface RescanResult {
  newFiles: string[];
  missingFiles: string[];
  movedFiles: string[];
  checksumMismatches: string[];
  sidecarConflicts: string[];
  deletedFromDb: string[];
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
  category?: string;
  documentType?: string;
  documentDate?: string;
  amount?: number;
  currency?: string;
}

export interface AiSettings {
  ai_provider?: 'openai' | 'ollama';
  ai_model?: string;
  ai_api_key?: string;
  ai_base_url?: string;
  ai_ollama_url?: string;
}

export interface AiMetadataSuggestion {
  category: string;
  documentType: string;
  confidence?: number;
  reason?: string;
}

export interface Settings extends AiSettings {
  folder_organization?: 'year-month' | 'category-year' | 'year-category' | 'type-year' | 'flat';
}
