import express from 'express';
import db from '../db/database.js';
import path from 'path';
import fs from 'fs';
import { marked } from 'marked';
import mammoth from 'mammoth';
import { createRequire } from 'module';
const { readFile: xlsxReadFile, utils: xlsxUtils } = createRequire(import.meta.url)('xlsx');

const router = express.Router();

const mdCss = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 16px; line-height: 1.6; color: #24292f; background: #fff;
    max-width: 860px; margin: 0 auto; padding: 32px 48px 64px;
}
h1,h2,h3,h4,h5,h6 { margin-top: 1.5em; margin-bottom: .5em; font-weight: 600; line-height: 1.25; }
h1 { font-size: 2em;    border-bottom: 1px solid #d8dee4; padding-bottom: .3em; }
h2 { font-size: 1.5em;  border-bottom: 1px solid #d8dee4; padding-bottom: .3em; }
h3 { font-size: 1.25em; }
p  { margin: .75em 0; }
a  { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
code {
    font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
    font-size: 85%; background: #f6f8fa; padding: .2em .4em; border-radius: 6px;
}
pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow: auto; margin: 1em 0; }
pre code { background: transparent; padding: 0; font-size: 93%; }
blockquote { padding: 0 1em; color: #57606a; border-left: 4px solid #d0d7de; margin: 1em 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th { background: #f6f8fa; font-weight: 600; }
th, td { border: 1px solid #d0d7de; padding: 6px 13px; text-align: left; }
tr:nth-child(even) td { background: #f6f8fa; }
img { max-width: 100%; height: auto; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
ul, ol { padding-left: 2em; margin: .5em 0; }
li { margin: .2em 0; }
input[type=checkbox] { margin-right: .4em; }
`;

const spreadsheetCss = `
.tabs { display: flex; gap: 4px; flex-wrap: wrap; padding: 0 0 12px; border-bottom: 1px solid #d0d7de; margin-bottom: 16px; }
.tab { padding: 4px 12px; border-radius: 6px; border: 1px solid #d0d7de; background: #f6f8fa; cursor: pointer; font-size: 13px; }
.tab.active { background: #0969da; color: #fff; border-color: #0969da; }
.sheet { display: none; overflow: auto; }
.sheet.active { display: block; }
table { border-collapse: collapse; font-size: 13px; white-space: nowrap; }
td, th { border: 1px solid #d0d7de; padding: 4px 10px; }
tr:nth-child(even) td { background: #f6f8fa; }
`;

const sheetScript = `
<script>
function showSheet(i) {
  document.querySelectorAll('.sheet').forEach((el, j) => el.classList.toggle('active', i === j));
  document.querySelectorAll('.tab').forEach((el, j) => el.classList.toggle('active', i === j));
}
</script>`;

function wrapHtml(body: string, css: string, extra = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}${extra}</body></html>`;
}

router.get('/:id', async (req, res) => {
  try {
    const doc = db.prepare('SELECT filePath, storedFilename FROM documents WHERE id = ?').get(req.params.id) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const ext = path.extname(doc.storedFilename || doc.filePath || '').toLowerCase();
    const supportedPreviews = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.txt', '.md', '.MD', '.docx', '.xlsx', '.xls', '.xlsb', '.xlsm', '.ods', '.csv', '.json', '.xml', '.yaml', '.yml', '.log'];

    if (!supportedPreviews.includes(ext)) {
      return res.status(415).json({
        error: 'Unsupported preview format',
        supported: supportedPreviews
      });
    }

    if (ext === '.md' || ext === '.MD') {
      const markdown = fs.readFileSync(doc.filePath, 'utf-8');
      const html = marked(markdown);
      return res.type('html').send(wrapHtml(html as string, mdCss));
    }

    if (ext === '.docx') {
      const { value: html } = await mammoth.convertToHtml({ path: doc.filePath });
      return res.type('html').send(wrapHtml(html, mdCss));
    }

    if (['.xlsx', '.xls', '.xlsb', '.xlsm', '.ods', '.csv'].includes(ext)) {
      const workbook = xlsxReadFile(doc.filePath);
      const sheetTabs = workbook.SheetNames.map((name: string, i: number) => `
        <button class="tab${i === 0 ? ' active' : ''}" onclick="showSheet(${i})">${name}</button>
      `).join('');
      const sheetContents = workbook.SheetNames.map((name: string, i: number) => {
        const sheet = workbook.Sheets[name];
        const html = sheet['!ref'] ? xlsxUtils.sheet_to_html(sheet) : '<p style="color:#888;padding:16px">Empty sheet</p>';
        return `<div class="sheet${i === 0 ? ' active' : ''}">${html}</div>`;
      }).join('');
      const body = `<div class="tabs">${sheetTabs}</div>${sheetContents}`;
      return res.type('html').send(wrapHtml(body, mdCss + spreadsheetCss, sheetScript));
    }

    if (['.json', '.xml', '.yaml', '.yml', '.log'].includes(ext)) {
      const text = fs.readFileSync(doc.filePath, 'utf-8');
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const body = `<pre><code>${escaped}</code></pre>`;
      return res.type('html').send(wrapHtml(body, mdCss));
    }

    res.sendFile(doc.filePath, (err) => {
      if (err) res.status(500).json({ error: 'Could not serve preview' });
    });
  } catch (err: any) {
    console.error('[preview] error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/thumb/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT filePath, storedFilename FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const ext = path.extname(doc.storedFilename).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

    if (!imageExts.includes(ext)) {
      return res.status(415).json({ error: 'Not an image file' });
    }

    res.sendFile(doc.filePath, (err) => {
      if (err) {
        res.status(500).json({ error: 'Could not serve thumbnail' });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
