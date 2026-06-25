# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Keepr is a self-hosted personal document vault â€” a full-stack TypeScript monorepo (React + Express) that stores files as real files on disk with portable `.sidecar.json` sidecar metadata and an indexed SQLite database for search.

## Commands

```bash
# Development (runs both client and server concurrently)
npm run dev

# Build (client: tsc + vite, server: tsc)
npm run build

# Production
npm start                          # node server/dist/index.js

# Tests (Vitest + Supertest, server workspace only)
npm run test                       # all tests
npm run test -- --reporter=verbose # with detail
npx vitest run server/tests/documents.test.ts  # single test file

# Lint
npm run lint
```

Dev servers: client at `localhost:3110`, API at `localhost:3111`. The Vite dev server proxies `/api` to the Express server.

## Architecture

**Core principle**: files remain real files on disk; Keepr adds metadata structure around them.

### Storage model
Every document has three representations that must stay in sync:
1. The actual file at `vault/documents/{year}/{month}/{safe_filename}`
2. A `.sidecar.json` sidecar alongside the file (enables DB recovery from disk)
3. A row in the SQLite database (`vault/data.db`) for search/indexing

### Server (`server/src/`)
- **`config.ts`** â€” central config (`port`, `vaultRoot`); reads `PORT` and `VAULT_ROOT` env vars
- **`index.ts`** â€” entry point: `initDb()` â†’ `runMigrations()` â†’ `createApp()` â†’ listen
- **`app.ts`** â€” `createApp()` factory: mounts middleware (compression, cors, morgan) and all route prefixes; serves client build in production
- **`db/connection.ts`** â€” sql.js in-memory SQLite with a `Statement` wrapper (`all`, `get`, `run`) and `DatabaseWrapper` (`prepare`, `exec`, `transaction`); exports `initDb`, `getDb`, `saveDb`, default `dbWrapper`
- **`db/migrate.ts`** â€” discovers and runs `.sql` files from `db/migrations/` in order; tracks applied migrations in `_migrations` table
- **`db/migrations/001_initial.sql`** â€” creates all tables and seeds default categories
- **`db/database.ts`** â€” thin re-export shim from `connection.ts` (kept for any legacy imports)
- **`services/documentService.ts`** â€” core upload logic: SHA256 checksum, safe filename generation (`date_vendor_title_type.ext`), sidecar creation, DB insert
- **`services/rescanService.ts`** â€” vault integrity: detects new/missing/moved/duplicate files by comparing disk state to DB
- **`models/document.ts`** â€” Zod schema that defines the canonical document shape
- **`routes/`** â€” 8 route files: `documents`, `search`, `bulk`, `import`, `rescan`, `metadata`, `preview`, `export`

### Client (`client/src/`)
- **`types.ts`** â€” shared interfaces: `Document`, `RescanResult`, `ImportResult`
- **`api.ts`** â€” typed fetch wrapper; all server calls go through `api.*` methods (`getDocuments`, `uploadDocument`, `bulkDeleteDocuments`, `rescan`, etc.)
- **`contexts/DocumentsContext.tsx`** â€” global document list state; uses `api.ts`
- **`contexts/ThemeContext.tsx`** â€” dark/light theme, persisted to localStorage
- **`pages/`** â€” FrontPage (dashboard stats), DocumentsPage (grid/table), DocumentDetailPage, InboxPage (unsorted docs), SettingsPage, DonatePage
- **`components/`** â€” Layout, UploadModal, Toast, ThemePicker, Footer

React Router v7 with nested routes under a shared Layout component.

### Database schema
`documents` table has: id, title, description, category, documentType, vendor, amount, currency, documentDate, expiryDate, reminderDate, tags (JSON array), people (JSON array), assets (JSON array), notes, originalFilename, storedFilename, filePath, sidecarPath, checksum, fileSize, createdAt, updatedAt.

Supporting tables: `categories` (16 defaults like Identity, Finance, Housing), `people`, `assets`, `_migrations`.

### Key conventions
- Vault root comes from `config.vaultRoot` (`VAULT_ROOT` env var, default `./vault`) â€” never hardcode `process.cwd()/vault`
- DB lives at `{vaultRoot}/data.db`; add new schema as a numbered `.sql` file in `db/migrations/`
- All client API calls go through `api.ts` â€” never raw `fetch` in components
- Filenames are sanitized via `fileUtils.ts` before writing to disk
- SHA256 checksums are used for duplicate detection on upload and import
- `CONCEPT.md` in the repo root is the product spec â€” check it before adding features to understand intended scope vs. deferred features (OCR, email import, encrypted storage)

