import db from '../db/database.js';
import { DOCUMENT_TYPES } from '../constants/metadata.js';
import { extractDocumentText, type ExtractedDocumentText } from './textExtractionService.js';

type AiProvider = 'openai' | 'ollama';

export interface AiMetadataSuggestion {
  category: string;
  documentType: string;
  confidence?: number;
  reason?: string;
}

interface AiSettings {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  ollamaUrl: string;
}

interface DocumentContext {
  title?: string;
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
  fileSize?: number;
  createdAt?: string;
}

function getSettings(): AiSettings {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?, ?)').all(
    'ai_provider',
    'ai_model',
    'ai_api_key',
    'ai_base_url',
    'ai_ollama_url'
  ) as { key: string; value: string }[];

  const values: Record<string, string> = {};
  for (const row of rows) values[row.key] = row.value;

  const provider = values.ai_provider === 'ollama' ? 'ollama' : 'openai';
  return {
    provider,
    model: values.ai_model || (provider === 'ollama' ? 'llama3.1' : 'gpt-4o-mini'),
    apiKey: values.ai_api_key || '',
    baseUrl: values.ai_base_url || 'https://api.openai.com/v1',
    ollamaUrl: values.ai_ollama_url || 'http://localhost:11434',
  };
}

function getCategories(): string[] {
  return (db.prepare('SELECT name FROM categories ORDER BY name').all() as { name: string }[]).map(row => row.name);
}

function buildMessages(doc: DocumentContext, categories: string[], extracted: ExtractedDocumentText) {
  const { filePath: _filePath, ...documentMetadata } = doc;

  return [
    {
      role: 'system' as const,
      content: [
        'You classify personal vault documents.',
        'Return only JSON with keys: category, documentType, confidence, reason.',
        'category must be exactly one of the allowed categories.',
        'documentType must be exactly one of the allowed document types.',
        'Classify primarily from documentText when it is present; use filename and metadata only as supporting context.',
        'Understand common personal-document terms in English and Danish.',
        'If documentText is unavailable or empty, classify from metadata with lower confidence.',
        'Do not invent facts beyond the provided content.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        allowedCategories: categories,
        allowedDocumentTypes: DOCUMENT_TYPES,
        document: documentMetadata,
        textExtraction: {
          source: extracted.source,
          warning: extracted.warning,
          includedCharacters: extracted.text.length,
        },
        documentText: extracted.text,
      }, null, 2),
    },
  ];
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI did not return JSON');
    return JSON.parse(match[0]);
  }
}

function normalizeSuggestion(raw: unknown, categories: string[]): AiMetadataSuggestion {
  const data = raw as Partial<AiMetadataSuggestion>;
  const category = typeof data.category === 'string' ? data.category : '';
  const documentType = typeof data.documentType === 'string' ? data.documentType : '';

  if (!categories.includes(category)) {
    throw new Error(`AI returned unsupported category: ${category || '(empty)'}`);
  }
  if (!DOCUMENT_TYPES.includes(documentType as any)) {
    throw new Error(`AI returned unsupported document type: ${documentType || '(empty)'}`);
  }

  return {
    category,
    documentType,
    confidence: typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : undefined,
    reason: typeof data.reason === 'string' ? data.reason.slice(0, 240) : undefined,
  };
}

type AiMessages = ReturnType<typeof buildMessages>;

async function callOpenAiCompatible(settings: AiSettings, messages: AiMessages): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('OpenAI/API mode requires an AI API key in Settings');
  }

  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || '';
}

async function callOllama(settings: AiSettings, messages: AiMessages): Promise<string> {
  const url = `${settings.ollamaUrl.replace(/\/$/, '')}/api/chat`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: false,
      format: 'json',
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { message?: { content?: string } };
  return data.message?.content || '';
}

export async function suggestDocumentMetadata(documentId: string): Promise<AiMetadataSuggestion> {
  const doc = db.prepare(`
    SELECT title, description, category, documentType, amount, currency,
      documentDate, tags, notes,
      originalFilename, storedFilename, filePath, fileSize, createdAt
    FROM documents
    WHERE id = ?
  `).get(documentId) as DocumentContext | null;

  if (!doc) {
    throw new Error('Document not found');
  }

  const settings = getSettings();
  const categories = getCategories();

  // Endpoint the request will actually hit — logged on failure for diagnosis.
  const endpoint = settings.provider === 'ollama'
    ? `${settings.ollamaUrl.replace(/\/$/, '')}/api/chat`
    : `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;

  try {
    const extracted = await extractDocumentText(doc.filePath || '', doc.storedFilename || doc.originalFilename || '');
    const messages = buildMessages(doc, categories, extracted);
    const content = settings.provider === 'ollama'
      ? await callOllama(settings, messages)
      : await callOpenAiCompatible(settings, messages);

    return normalizeSuggestion(extractJson(content), categories);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[ai:suggest-metadata] FAILED', {
      documentId,
      provider: settings.provider,
      model: settings.model,
      endpoint,
      ollamaUrl: settings.provider === 'ollama' ? settings.ollamaUrl : undefined,
      baseUrl: settings.provider === 'openai' ? settings.baseUrl : undefined,
      apiKeyPresent: settings.provider === 'openai' ? Boolean(settings.apiKey) : undefined,
      categoriesCount: categories.length,
      storedFilename: doc.storedFilename,
      originalFilename: doc.originalFilename,
      errorName: error.name,
      errorMessage: error.message,
      errorCause: (error as { cause?: unknown }).cause,
      stack: error.stack,
    });
    throw error;
  }
}

export async function listLocalModels(ollamaUrl?: string): Promise<string[]> {
  const settings = getSettings();
  const baseUrl = (ollamaUrl?.trim() || settings.ollamaUrl).replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const data = await response.json() as { models?: { name: string }[] };
  return (data.models || []).map(model => model.name).filter(name => !name.includes(':embed'));
}

export async function testAiConnection(): Promise<{ provider: AiProvider; model: string; ok: true; message: string }> {
  const settings = getSettings();

  if (settings.provider === 'ollama') {
    const models = await listLocalModels();
    if (!models.length) {
      throw new Error('Ollama is reachable, but no chat models were found');
    }
    if (settings.model && !models.includes(settings.model)) {
      throw new Error(`Ollama is reachable, but model "${settings.model}" was not found`);
    }
    return {
      provider: settings.provider,
      model: settings.model || models[0],
      ok: true,
      message: `Connected to Ollama with ${models.length} available model(s)`,
    };
  }

  if (!settings.apiKey) {
    throw new Error('OpenAI/API mode requires an AI API key in Settings');
  }

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/models`, {
    headers: { Authorization: `Bearer ${settings.apiKey}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible endpoint returned ${response.status}: ${await response.text()}`);
  }

  return {
    provider: settings.provider,
    model: settings.model,
    ok: true,
    message: 'Connected to OpenAI-compatible endpoint',
  };
}
