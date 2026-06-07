import db from '../db/database.js';
import { extractDocumentText, type ExtractedDocumentText } from './textExtractionService.js';

export type AiProvider = 'none' | 'openai' | 'ollama';

export interface AiMetadataSuggestion {
  title?: string;
  tags?: string[];
  confidence?: number;
  reason?: string;
}

// ─── Internal settings shape — no defaults, null means not configured ─────────

interface AiSettings {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  ollamaUrl: string;
  temperature: number | null; // null = not configured, let the model use its default
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(`[AI] ${new Date().toISOString()} | ${event} |`, JSON.stringify(data));
}

// ─── Settings: read from DB exactly as stored, no fallbacks ──────────────────

function readSettings(): AiSettings {
  const rows = db.prepare(
    'SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?, ?, ?, ?, ?)'
  ).all('ai_provider', 'ai_model', 'ai_openai_model', 'ai_ollama_model', 'ai_api_key', 'ai_base_url', 'ai_ollama_url', 'ai_temperature') as { key: string; value: string }[];

  const v: Record<string, string> = {};
  for (const row of rows) v[row.key] = row.value;

  const provider: AiProvider =
    v.ai_provider === 'openai' ? 'openai' :
    v.ai_provider === 'ollama' ? 'ollama' : 'none';

  const rawTemp = v.ai_temperature?.trim();
  const parsedTemp = rawTemp ? parseFloat(rawTemp) : NaN;
  const temperature = !isNaN(parsedTemp) ? parsedTemp : null;

  // Use provider-specific model fields; fall back to legacy ai_model for existing installs
  const model = provider === 'openai'
    ? (v.ai_openai_model || v.ai_model || '')
    : (v.ai_ollama_model || v.ai_model || '');

  const settings: AiSettings = {
    provider,
    model,
    apiKey:      v.ai_api_key    || '',
    baseUrl:     v.ai_base_url   || '',
    ollamaUrl:   v.ai_ollama_url || '',
    temperature,
  };

  log('settings.read', {
    provider:    settings.provider,
    model:       settings.model    || null,
    baseUrl:     settings.provider === 'openai' ? (settings.baseUrl   || null) : undefined,
    ollamaUrl:   settings.provider === 'ollama' ? (settings.ollamaUrl || null) : undefined,
    apiKeySet:   settings.provider === 'openai' ? Boolean(settings.apiKey)     : undefined,
    temperature: settings.temperature,
  });

  return settings;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function assertReady(s: AiSettings): void {
  if (s.provider === 'none') {
    throw new Error('AI provider is not configured — select one in Settings');
  }
  if (s.provider === 'openai') {
    if (!s.baseUrl) throw new Error('OpenAI base URL is not set — configure it in Settings');
    if (!s.apiKey)  throw new Error('OpenAI API key is not set — configure it in Settings');
    if (!s.model)   throw new Error('OpenAI model is not set — configure it in Settings');
  }
  if (s.provider === 'ollama') {
    if (!s.ollamaUrl) throw new Error('Ollama URL is not set — configure it in Settings');
    if (!s.model)     throw new Error('Ollama model is not set — configure it in Settings');
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

interface DocumentContext {
  title?: string;
  description?: string;
  documentDate?: string;
  tags?: string;
  notes?: string;
  originalFilename?: string;
  storedFilename?: string;
  filePath?: string;
  fileSize?: number;
  createdAt?: string;
}

function buildMessages(doc: DocumentContext, extracted: ExtractedDocumentText) {
  const { filePath: _fp, title: _t, ...meta } = doc;
  return [
    {
      role: 'system' as const,
      content: [
        'You suggest metadata for personal vault documents.',
        'Return only JSON with keys: title, tags, confidence, reason.',
        'title and tags must always be in English, regardless of the document language.',
        'title must be clean and human-readable — never a raw filename or slug.',
        'Convert hyphenated/underscored filenames into proper titles (e.g. "my-tax-return-2024" → "Tax Return 2024").',
        'tags should be an array of relevant lowercase English tags (e.g. ["tax", "2024", "income"]).',
        'If visual content (image or PDF) is provided, analyse it to improve title and tag accuracy.',
        'Classify primarily from document content; use filename and metadata as supporting context.',
        'If no document content is available, derive title and tags from the filename.',
        'Do not invent facts beyond the provided content.',
        'title is required — always return a non-empty title string.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        document: meta,
        textExtraction: {
          source: extracted.source,
          warning: extracted.warning,
          includedCharacters: extracted.text.length,
          hasAttachment: !!extracted.attachment,
          attachmentType: extracted.attachment?.mimeType,
        },
        documentText: extracted.text,
      }, null, 2),
    },
  ];
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI did not return JSON');
  return JSON.parse(match[0]);
}

function normalizeSuggestion(raw: unknown): AiMetadataSuggestion {
  const d = raw as Partial<AiMetadataSuggestion & { tags: unknown }>;
  const tags: string[] = [];
  if (Array.isArray(d.tags)) for (const t of d.tags) { if (typeof t === 'string') tags.push(t); }
  return {
    title:      typeof d.title      === 'string' ? d.title                                : undefined,
    tags:       tags.length > 0                  ? tags                                    : undefined,
    confidence: typeof d.confidence === 'number' ? Math.max(0, Math.min(1, d.confidence)) : undefined,
    reason:     typeof d.reason     === 'string' ? d.reason.slice(0, 240)                 : undefined,
  };
}

// ─── AI provider calls ────────────────────────────────────────────────────────

type Messages = ReturnType<typeof buildMessages>;
type Attachment = ExtractedDocumentText['attachment'];

async function callOllama(s: AiSettings, messages: Messages, attachment: Attachment): Promise<string> {
  const url = `${s.ollamaUrl.replace(/\/$/, '')}/api/chat`;
  const isImage = attachment?.mimeType.startsWith('image/');
  log('fetch.start', { provider: 'ollama', url, model: s.model, attachmentType: attachment?.mimeType ?? null });

  // Ollama: images attach to the user message via the `images` array.
  // PDFs are not a supported type — we skip them and rely on any extracted text.
  const ollamaMessages = messages.map((msg, i) => {
    if (i === messages.length - 1 && isImage) {
      return { ...msg, images: [attachment!.base64] };
    }
    return msg;
  });

  const ollamaOptions: Record<string, unknown> = { think: false };
  if (s.temperature !== null) ollamaOptions.temperature = s.temperature;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: s.model,
      messages: ollamaMessages,
      stream: false,
      format: 'json',
      options: ollamaOptions,
    }),
    signal: AbortSignal.timeout(300000),
  });

  log('fetch.end', { provider: 'ollama', url, model: s.model, status: response.status, ok: response.ok });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }

  const data = await response.json() as { message?: { content?: string } };
  return data.message?.content || '';
}

async function callOpenAi(s: AiSettings, messages: Messages, attachment: Attachment): Promise<string> {
  const url = `${s.baseUrl.replace(/\/$/, '')}/chat/completions`;
  // OpenAI image_url only accepts image/* types — PDFs are not supported via this path.
  const isImage = attachment?.mimeType.startsWith('image/');
  log('fetch.start', { provider: 'openai', url, model: s.model, attachmentType: attachment?.mimeType ?? null, attachingImage: isImage ?? false });

  const openAiMessages = messages.map((msg, i) => {
    if (i === messages.length - 1 && isImage) {
      return {
        role: msg.role,
        content: [
          { type: 'text', text: msg.content },
          { type: 'image_url', image_url: { url: `data:${attachment!.mimeType};base64,${attachment!.base64}`, detail: 'auto' } },
        ],
      };
    }
    return msg;
  });

  const body: Record<string, unknown> = {
    model: s.model,
    messages: openAiMessages,
    response_format: { type: 'json_object' },
  };
  if (s.temperature !== null) body.temperature = s.temperature;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(isImage ? 60000 : 30000),
  });

  log('fetch.end', { provider: 'openai', url, model: s.model, status: response.status, ok: response.ok });

  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try { detail = (JSON.parse(body) as { error?: { message?: string } })?.error?.message || body; } catch {}
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || '';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function suggestDocumentMetadata(documentId: string): Promise<AiMetadataSuggestion> {
  log('suggest.start', { documentId });

  const doc = db.prepare(
    'SELECT title, description, documentDate, tags, notes, originalFilename, storedFilename, filePath, fileSize, createdAt, extractedText FROM documents WHERE id = ?'
  ).get(documentId) as DocumentContext | null;

  if (!doc) throw new Error('Document not found');

  const settings = readSettings();
  assertReady(settings);

  const activeUrl = settings.provider === 'ollama' ? settings.ollamaUrl : settings.baseUrl;
  log('suggest.using', { provider: settings.provider, model: settings.model, url: activeUrl });

  try {
    // Use cached OCR text if available — avoids redundant re-extraction
    const cachedText = (doc as any).extractedText as string | null;
    const extracted = (cachedText && cachedText.length > 50)
      ? { text: cachedText, source: 'text' as const }
      : await extractDocumentText(
          doc.filePath || '',
          doc.storedFilename || doc.originalFilename || ''
        );
    const messages = buildMessages(doc, extracted);
    const content = settings.provider === 'ollama'
      ? await callOllama(settings, messages, extracted.attachment)
      : await callOpenAi(settings, messages, extracted.attachment);

    const suggestion = normalizeSuggestion(extractJson(content));
    log('suggest.success', {
      documentId,
      provider: settings.provider,
      model: settings.model,
      url: activeUrl,
      extractionSource: extracted.source,
      hasAttachment: !!extracted.attachment,
      attachmentType: extracted.attachment?.mimeType ?? null,
      title: suggestion.title,
      tagCount: suggestion.tags?.length ?? 0,
    });
    return suggestion;

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    let detail: string;
    if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message.toLowerCase().includes('aborted')) {
      detail = 'timed out — model may be too slow or unavailable';
    } else if (error.message === 'fetch failed') {
      const cause = (error as { cause?: unknown }).cause;
      const causeMsg = cause instanceof Error ? cause.message : '';
      detail = causeMsg ? `unreachable (${causeMsg})` : 'unreachable — is the service running?';
    } else {
      detail = error.message;
    }

    log('suggest.error', {
      documentId,
      provider: settings.provider,
      model: settings.model,
      url: activeUrl,
      errorName: error.name,
      errorCause: String((error as { cause?: unknown }).cause ?? ''),
      detail,
      stack: error.stack,
    });

    throw new Error(`${settings.provider === 'ollama' ? 'Ollama' : 'OpenAI'} (${activeUrl}): ${detail}`);
  }
}

export async function listLocalModels(ollamaUrl?: string): Promise<string[]> {
  const baseUrl = (ollamaUrl?.trim() || '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('Ollama URL is not configured — set it in Settings');

  log('listModels.start', { url: baseUrl });

  const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

  const data = await response.json() as { models?: { name: string }[] };
  const models = (data.models || []).map(m => m.name).filter(n => !n.includes(':embed'));

  log('listModels.end', { url: baseUrl, count: models.length, models });
  return models;
}

export async function testAiConnection(): Promise<{ provider: AiProvider; model: string; ok: true; message: string }> {
  const settings = readSettings();
  assertReady(settings);

  if (settings.provider === 'ollama') {
    const models = await listLocalModels(settings.ollamaUrl);
    if (!models.length) throw new Error('Ollama is reachable, but no chat models were found');
    if (!models.includes(settings.model)) throw new Error(`Ollama is reachable, but model "${settings.model}" was not found`);
    return { provider: 'ollama', model: settings.model, ok: true, message: `Connected to Ollama with ${models.length} available model(s)` };
  }

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/models`, {
    headers: { Authorization: `Bearer ${settings.apiKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`OpenAI endpoint returned ${response.status}: ${await response.text()}`);
  return { provider: 'openai', model: settings.model, ok: true, message: 'Connected to OpenAI-compatible endpoint' };
}
