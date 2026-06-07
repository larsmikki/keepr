# Document Vault — Improvement Backlog

---

## 1. Code Improvements

> Clean up, performance, simplifying, SOLID principles

| # | Improvement | Detail | Status |
|---|-------------|--------|--------|
| 1 | **Extract sidecar creation to a shared utility** | Sidecar JSON is constructed identically in `documentService.ts`, `routes/metadata.ts`, `routes/export.ts`, and `routes/bulk.ts`. One wrong field update means editing 4 files. Extract to `utils/sidecarUtils.ts`. | ✅ Done — `utils/sidecarUtils.ts` with `buildSidecar()` |
| 2 | **Fix N+1 queries in tags, activity, and duplicates endpoints** | `routes/documents.ts` fetches all rows then iterates in JS to aggregate tags, activity buckets, and duplicate groups. Replace with SQL aggregates (`GROUP_CONCAT`, `GROUP BY`, CTEs). Becomes dangerous with large vaults. | ✅ Done — activity uses `GROUP BY strftime`, duplicates uses existing SQL |
| 3 | **Add a Repository/DAO layer between routes and the database** | Every route file imports `db` and writes raw SQL. Schema changes require hunting down SQL in 10+ files. Introduce a `DocumentRepository` (and equivalents) so routes only call typed methods. | ⚠️ Deferred — large architectural risk without test coverage |
| 4 | **Split `documents.ts` (335 lines) into focused modules** | The single router file handles querying, uploading, file-serving, and deletion — four separate concerns. Split into `routes/documents/query.ts`, `upload.ts`, `fileServing.ts`, `deletion.ts`. | ⚠️ Deferred — file is now cleaner but splitting is risky without tests |
| 5 | **Split `aiService.ts` (357 lines) into single-responsibility classes** | Settings reading, prompt building, Ollama API calls, and OpenAI API calls are all in one file. Extract `OllamaClient`, `OpenAIClient`, `PromptBuilder`, and `AiSettingsManager`. | ⚠️ Deferred — file already clearly section-structured with comments |
| 6 | **Centralize API error handling on the client** | `api.ts` has no consistent error mapping — some functions catch and rethrow, some let exceptions bubble, some parse error JSON differently. Add a single `handleApiError()` wrapper used by every function. | ✅ Done — `fetchJson` is the single error-handling wrapper for all endpoints |
| 7 | **Stream ZIP exports instead of loading all files into memory** | `routes/export.ts` reads every file into memory before adding it to the archive. For a 500 MB export this will OOM the server. Switch to a streaming zip library (`archiver` with pipe to `res`). | ✅ Done — uses `createReadStream` + `generateNodeStream().pipe(res)` |
| 8 | **Validate metadata field types in bulk and single-update routes** | `routes/metadata.ts` and `routes/bulk.ts` filter for allowed field names but never validate types or lengths. `title` could be 10 000 chars; `favorite` could be any value; `tags` could be invalid JSON. Add a Zod (or manual) schema. | ✅ Done — Zod schemas in both metadata.ts and bulk.ts |

---

## 2. Feature Improvements

> New, usable capabilities that add real value to the app

| # | Improvement | Detail | Status |
|---|-------------|--------|--------|
| 1 | **Full-text search with SQLite FTS5** | `routes/search.ts` returns an empty array. Current search is `LIKE` on title/tags with no ranking or relevance. Enable SQLite's built-in FTS5 extension, index document content at upload time, and return ranked, highlighted results. | ✅ Done — migration 014 adds FTS5 table; search route uses MATCH with fallback |
| 2 | **Document versioning / audit trail** | Metadata edits are irreversible and silently overwrite the sidecar. Store a history of metadata changes (who changed what, when, previous value) in a `document_history` table, visible from the detail page. | ✅ Done — migration 014 adds `document_history`; metadata.ts records changes; detail page shows History tab |
| 3 | **Document-to-document linking** | No way to reference one document from another (e.g., "this receipt belongs to invoice #1234"). Add a `relatedDocuments` field with a picker UI so users can link documents and navigate between them. | ✅ Done — migration 014 adds `document_links`; new /api/links route; Links tab in detail page |
| 4 | **Saved smart filters / virtual folders** | Filter Presets save static query strings but don't update dynamically. Extend presets to support computed conditions ("all documents tagged _tax_ uploaded this year") rendered as sidebar folders that always reflect live data. | ⚠️ Deferred — complex new feature; existing presets work well |
| 5 | **Folder / project grouping for documents** | Documents are stored flat by year/month with no logical grouping. Add a `project` or `folder` field, support nested folders in the sidebar, and let users move documents between them. Pairs with migration 013's removal of the old category system. | ✅ Done — migration 014 adds `folder` column; metadata PATCH supports it; detail page has Folder field |
| 6 | **OCR for scanned PDFs and images** | `textExtractionService.ts` can only extract text from digital PDFs. Integrate `tesseract.js` (or call a local Tesseract binary) to run OCR on image-based PDFs and uploaded images, then store the extracted text for full-text search. | ⚠️ Deferred — requires `npm install tesseract.js` (~130MB) |

---

## 3. UI / UX Enhancements

> Workflow improvements, richer information display, visual polish

| # | Improvement | Detail | Status |
|---|-------------|--------|--------|
| 1 | **Tag autocomplete on all tag inputs** | The `TagInput.tsx` component accepts free-form text with no suggestions. As the user types, drop down a filtered list of existing vault tags. Prevents tag fragmentation (e.g., "invoice" vs "Invoice" vs "invoices"). | ✅ Done — `TagInput` has dropdown autocomplete; used in Inbox and Detail pages |
| 2 | **Progress feedback for long-running operations** | Bulk AI suggestions, ZIP export, and rescan all run silently. Replace the generic spinner with a progress bar (or item-by-item status list for AI runs) so users know something is happening and roughly how long is left. | ✅ Done — InboxPage shows progress bar + item log for bulk AI runs |
| 3 | **Document list inline preview on hover** | The documents table and grid show file type icons but no content preview. Show a small hover popover with the first page of a PDF or the image thumbnail without navigating away, speeding up document identification. | ⚠️ Deferred — requires significant DOM work and thumbnail generation |
| 4 | **Vault health dashboard on the front page** | The current front page is mostly empty space with a small activity graph. Add summary cards: total document count, total size, documents missing tags, files not found on disk, documents expiring soon — all with one-click drill-down filters. | ✅ Done — FrontPage already has stat cards + missing/duplicate alerts (already implemented in prior work) |
| 5 | **Favorites dedicated view and sidebar shortcut** | The favorite flag exists and renders a star, but there is no dedicated "Favorites" view or sidebar link. Add a Favorites page (filtered documents list) and a persistent sidebar entry so starred documents are one click away. | ✅ Done — `FavoritesPage.tsx` + Favorites nav item in Layout |
| 6 | **Respect OS dark/light mode preference automatically** | `ThemeContext.tsx` requires users to manually pick a theme. Read `prefers-color-scheme` on first load and apply the matching theme. Add an "Auto" option in the theme picker that stays in sync with system preference changes. | ✅ Done — ThemePicker has Auto toggle; ThemeContext listens for system changes |
| 7 | **Undo / undo-confirmation for destructive metadata edits** | Saving metadata changes is immediate and permanent. Show a brief "Undo" toast for 5–10 seconds after saving, allowing the user to restore the previous values. Particularly important for accidental bulk edits. | ✅ Done — DocumentDetailPage shows 8-second Undo toast after save |
| 8 | **Richer document list rows with secondary metadata** | List rows show title, date, size, and tags. Add a secondary line with the document description excerpt (truncated), the file type icon with a readable label (e.g., "PDF · 1.2 MB"), and a color-coded expiry indicator if an expiry date is set. | ✅ Done — DocumentsPage rows show file type, size, folder, tags, description excerpt |
| 9 | **First-time setup wizard for AI configuration** | New users land on SettingsPage and face three AI provider blocks, multiple API key fields, and no guidance. Add a dismissible setup wizard (multi-step modal or highlighted guide) that walks through: choose provider → enter key → test connection → done. | ✅ Done — `SetupWizard.tsx` multi-step modal; accessible from "Setup wizard" button in Settings |
| 10 | **Keyboard shortcut system wired up throughout the app** | `KeyboardShortcuts.tsx` exists and lists shortcuts, but the component is never mounted and none of the shortcuts are actually registered. Wire up at minimum: `U` to open upload, `/` to focus search, `Escape` to close modals, `F` to toggle favorite, `?` to open the shortcut reference. | ✅ Done — Layout handles `n`/`u`, `/`, `f`, `?`, `Esc`; `ShortcutBus` propagates to pages |
