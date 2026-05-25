import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';

export interface ExtractedDocumentText {
  text: string;
  source: 'pdf' | 'text' | 'office' | 'unsupported' | 'error';
  warning?: string;
}

const MAX_TEXT_CHARS = 12000;

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

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function extractTaggedText(xml: string, tagNames: string[]): string {
  const parts: string[] = [];
  for (const tagName of tagNames) {
    const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'g');
    for (const match of xml.matchAll(regex)) {
      const text = match[1].replace(/<[^>]+>/g, '');
      if (text.trim()) parts.push(decodeXmlEntities(text));
    }
  }
  return parts.join('\n');
}

async function readZipTextFiles(filePath: string, filePattern: RegExp): Promise<string[]> {
  const data = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(data);
  const files = Object.values(zip.files)
    .filter(file => !file.dir && filePattern.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const contents: string[] = [];
  for (const file of files) {
    contents.push(await file.async('string'));
  }
  return contents;
}

async function extractPdfText(filePath: string): Promise<ExtractedDocumentText> {
  const { PDFParse } = await import('pdf-parse');
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return { text: cleanAndLimit(result.text || ''), source: 'pdf' };
  } finally {
    await parser.destroy();
  }
}

async function extractPlainText(filePath: string): Promise<ExtractedDocumentText> {
  const text = await fs.readFile(filePath, 'utf8');
  return { text: cleanAndLimit(text), source: 'text' };
}

async function extractDocxText(filePath: string): Promise<ExtractedDocumentText> {
  const xmlFiles = await readZipTextFiles(filePath, /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/);
  const text = xmlFiles.map(xml => extractTaggedText(xml, ['w:t', 'w:instrText'])).join('\n\n');
  return { text: cleanAndLimit(text), source: 'office' };
}

async function extractPptxText(filePath: string): Promise<ExtractedDocumentText> {
  const xmlFiles = await readZipTextFiles(filePath, /^ppt\/slides\/slide\d+\.xml$/);
  const text = xmlFiles.map(xml => extractTaggedText(xml, ['a:t'])).join('\n\n');
  return { text: cleanAndLimit(text), source: 'office' };
}

async function extractXlsxText(filePath: string): Promise<ExtractedDocumentText> {
  const xmlFiles = await readZipTextFiles(filePath, /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/);
  const text = xmlFiles.map(xml => extractTaggedText(xml, ['t', 'v'])).join('\n\n');
  return { text: cleanAndLimit(text), source: 'office' };
}

async function extractOpenDocumentText(filePath: string): Promise<ExtractedDocumentText> {
  const xmlFiles = await readZipTextFiles(filePath, /^content\.xml$/);
  const text = xmlFiles
    .map(xml => decodeXmlEntities(xml.replace(/<text:(p|h|list-item|span|tab|line-break)(?:\s[^>]*)?>/g, '\n').replace(/<[^>]+>/g, ' ')))
    .join('\n\n');
  return { text: cleanAndLimit(text), source: 'office' };
}

async function extractRtfText(filePath: string): Promise<ExtractedDocumentText> {
  const rtf = await fs.readFile(filePath, 'utf8');
  const text = rtf
    .replace(/\\'[0-9a-f]{2}/gi, ' ')
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\[a-z]+\d* ?/gi, ' ')
    .replace(/[{}]/g, ' ');
  return { text: cleanAndLimit(text), source: 'office' };
}

export async function extractDocumentText(filePath: string, filename: string): Promise<ExtractedDocumentText> {
  const ext = path.extname(filename || filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      const result = await extractPdfText(filePath);
      return result.text
        ? result
        : { ...result, warning: 'No embedded PDF text was found. This may be a scanned image-only PDF.' };
    }

    if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm'].includes(ext)) {
      return extractPlainText(filePath);
    }

    if (ext === '.docx') return extractDocxText(filePath);
    if (ext === '.pptx') return extractPptxText(filePath);
    if (ext === '.xlsx') return extractXlsxText(filePath);
    if (['.odt', '.ods', '.odp'].includes(ext)) return extractOpenDocumentText(filePath);
    if (ext === '.rtf') return extractRtfText(filePath);

    if (['.doc', '.xls', '.ppt'].includes(ext)) {
      return { text: '', source: 'unsupported', warning: `Legacy binary ${ext} files are not supported for text extraction. Save as ${ext}x to enable AI classification from content.` };
    }

    return { text: '', source: 'unsupported', warning: `Text extraction is not supported for ${ext || 'this file type'}.` };
  } catch (err: any) {
    return {
      text: '',
      source: 'error',
      warning: err instanceof Error ? err.message : 'Text extraction failed.',
    };
  }
}
