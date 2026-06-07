import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execFileAsync = promisify(execFile);

export interface ExtractedDocumentText {
  text: string;
  source: 'text' | 'markitdown' | 'image' | 'ocr' | 'unsupported' | 'error';
  warning?: string;
  attachment?: {
    base64: string;
    mimeType: string;
  };
}

const MAX_TEXT_CHARS = 12000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB raw → ~13 MB base64
// If markitdown returns fewer chars than this for a PDF, treat it as scanned
const SCANNED_PDF_THRESHOLD = 150;
// Max PDF pages to OCR (to avoid very long processing times)
const MAX_OCR_PAGES = 8;

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.bmp': 'image/bmp', '.webp': 'image/webp',
  '.tiff': 'image/tiff', '.tif': 'image/tiff',
};

function cleanAndLimit(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/\b\d{6}[- ]?\d{4}\b/g, '[redacted personal id]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

async function readFileAsAttachment(filePath: string, mimeType: string): Promise<{ base64: string; mimeType: string } | undefined> {
  try {
    const data = await fs.readFile(filePath);
    if (data.length > MAX_ATTACHMENT_BYTES) return undefined;
    return { base64: data.toString('base64'), mimeType };
  } catch {
    return undefined;
  }
}

async function extractPlainText(filePath: string): Promise<ExtractedDocumentText> {
  const text = await fs.readFile(filePath, 'utf8');
  return { text: cleanAndLimit(text), source: 'text' };
}

function markitdownError(err: any): ExtractedDocumentText {
  if (err.killed) {
    return { text: '', source: 'error', warning: 'markitdown timed out processing this file.' };
  }
  const detail = (err.stderr as string | undefined)?.trim() || err.message || String(err);
  return { text: '', source: 'error', warning: `markitdown failed: ${detail}` };
}

async function extractWithMarkitdown(filePath: string): Promise<ExtractedDocumentText> {
  const opts = { timeout: 60_000, maxBuffer: 20 * 1024 * 1024 };

  const candidates: [string, string[]][] = [
    ['markitdown',  [filePath]],
    ['python',      ['-m', 'markitdown', filePath]],
    ['python3',     ['-m', 'markitdown', filePath]],
  ];

  for (const [cmd, args] of candidates) {
    try {
      const { stdout } = await execFileAsync(cmd, args, opts);
      const text = cleanAndLimit(stdout.trim());
      return text
        ? { text, source: 'markitdown' }
        : { text: '', source: 'markitdown', warning: 'markitdown returned empty content for this file.' };
    } catch (err: any) {
      if (err.code !== 'ENOENT') return markitdownError(err);
    }
  }

  return { text: '', source: 'error', warning: 'markitdown is not installed — run: pip install markitdown' };
}

// ─── OCR via tesseract.js ─────────────────────────────────────────────────────

async function ocrBuffer(imageBuffer: Buffer): Promise<string> {
  try {
    const { default: Tesseract } = await import('tesseract.js');
    const { data: { text } } = await (Tesseract as any).recognize(imageBuffer, 'eng', {
      logger: () => {},
    });
    return typeof text === 'string' ? text.trim() : '';
  } catch (err: any) {
    console.warn('[ocr] tesseract.js failed:', err.message);
    return '';
  }
}

// ─── PDF page rendering for scanned PDFs ─────────────────────────────────────

async function renderPdfPages(pdfPath: string): Promise<Buffer[]> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Disable worker — process synchronously in the main thread
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const pdfBuffer = await fs.readFile(pdfPath);
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pageCount = Math.min(pdf.numPages, MAX_OCR_PAGES);
  const buffers: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');

    const canvasFactory = {
      create(w: number, h: number) {
        const c = createCanvas(w, h);
        return { canvas: c, context: c.getContext('2d') };
      },
      reset(pair: any, w: number, h: number) {
        pair.canvas.width = w;
        pair.canvas.height = h;
      },
      destroy(_pair: any) {},
    };

    await page.render({
      canvasContext: ctx as any,
      viewport,
      canvasFactory,
    }).promise;

    buffers.push((canvas as any).toBuffer('image/png'));
    page.cleanup();
  }

  return buffers;
}

async function extractWithOcrPdf(filePath: string): Promise<string> {
  try {
    const pages = await renderPdfPages(filePath);
    const texts: string[] = [];
    for (const buf of pages) {
      const text = await ocrBuffer(buf);
      if (text) texts.push(text);
    }
    return cleanAndLimit(texts.join('\n\n'));
  } catch (err: any) {
    console.warn('[ocr] PDF OCR failed:', err.message);
    return '';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractDocumentText(filePath: string, filename: string): Promise<ExtractedDocumentText> {
  const ext = path.extname(filename || filePath).toLowerCase();
  console.log(`[extract] start | ext=${ext || '(none)'} | file=${filename || filePath}`);

  try {
    let result: ExtractedDocumentText;

    if (['.txt', '.md'].includes(ext)) {
      result = await extractPlainText(filePath);
    } else {
      const imageMime = IMAGE_MIME_TYPES[ext];
      if (imageMime) {
        // Images: OCR for text storage + vision attachment for AI
        const [ocrText, attachment] = await Promise.all([
          ocrBuffer(await fs.readFile(filePath)),
          readFileAsAttachment(filePath, imageMime),
        ]);

        result = {
          text: cleanAndLimit(ocrText),
          source: ocrText ? 'ocr' : 'image',
          ...(attachment ? { attachment } : { warning: 'Image exceeds 10 MB limit for direct AI input.' }),
        };
      } else if (ext === '.pdf') {
        // PDFs: try markitdown first; fall back to page-rendering OCR if sparse
        const mdResult = await extractWithMarkitdown(filePath);

        if (mdResult.text.length >= SCANNED_PDF_THRESHOLD) {
          result = mdResult;
        } else {
          console.log(`[extract] sparse PDF text (${mdResult.text.length} chars) — attempting OCR`);
          const ocrText = await extractWithOcrPdf(filePath);
          if (ocrText) {
            result = { text: ocrText, source: 'ocr' };
          } else {
            result = mdResult.text
              ? mdResult
              : { text: '', source: 'error', warning: 'PDF appears to be scanned but OCR could not extract text.' };
          }
        }
      } else {
        result = await extractWithMarkitdown(filePath);
      }
    }

    console.log(`[extract] done | ext=${ext} | source=${result.source} | chars=${result.text.length} | hasAttachment=${!!result.attachment}`);
    return result;
  } catch (err: any) {
    const warning = err instanceof Error ? err.message : 'Text extraction failed.';
    console.error(`[extract] error | ext=${ext} | ${warning}`);
    return { text: '', source: 'error', warning };
  }
}
