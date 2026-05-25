import express from 'express';
import db from '../db/database.js';
import path from 'path';
import fs from 'fs';
import { marked } from 'marked';

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

router.get('/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT filePath, storedFilename FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const ext = path.extname(doc.storedFilename).toLowerCase();
    const supportedPreviews = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.txt', '.md', '.MD'];

    if (!supportedPreviews.includes(ext)) {
      return res.status(415).json({
        error: 'Unsupported preview format',
        supported: supportedPreviews
      });
    }

    if (ext === '.md' || ext === '.MD') {
      const markdown = fs.readFileSync(doc.filePath, 'utf-8');
      const html = marked(markdown);
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${mdCss}</style>
</head>
<body>${html}</body>
</html>`;
      res.type('html').send(fullHtml);
      return;
    }

    res.sendFile(doc.filePath, (err) => {
      if (err) {
        res.status(500).json({ error: 'Could not serve preview' });
      }
    });
  } catch (err: any) {
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
