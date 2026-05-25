# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vaulty is a self-hosted personal document vault — a full-stack TypeScript monorepo (React + Express) that stores files as real files on disk with portable `.vaulty.json` sidecar metadata and an indexed SQLite database for search.

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

**Core principle**: files remain real files on disk; Vaulty adds metadata structure around them.

### Storage model
Every document has three representations that must stay in sync:
1. The actual file at `vault/documents/{year}/{month}/{safe_filename}`
2. A `.vaulty.json` sidecar alongside the file (enables DB recovery from disk)
3. A row in the SQLite database (`vault/vaulty.db`) for search/indexing

### Server (`server/src/`)
- **`config.ts`** — central config (`port`, `vaultRoot`); reads `PORT` and `VAULT_ROOT` env vars
- **`index.ts`** — entry point: `initDb()` → `runMigrations()` → `createApp()` → listen
- **`app.ts`** — `createApp()` factory: mounts middleware (compression, cors, morgan) and all route prefixes; serves client build in production
- **`db/connection.ts`** — sql.js in-memory SQLite with a `Statement` wrapper (`all`, `get`, `run`) and `DatabaseWrapper` (`prepare`, `exec`, `transaction`); exports `initDb`, `getDb`, `saveDb`, default `dbWrapper`
- **`db/migrate.ts`** — discovers and runs `.sql` files from `db/migrations/` in order; tracks applied migrations in `_migrations` table
- **`db/migrations/001_initial.sql`** — creates all tables and seeds default categories
- **`db/database.ts`** — thin re-export shim from `connection.ts` (kept for any legacy imports)
- **`services/documentService.ts`** — core upload logic: SHA256 checksum, safe filename generation (`date_vendor_title_type.ext`), sidecar creation, DB insert
- **`services/rescanService.ts`** — vault integrity: detects new/missing/moved/duplicate files by comparing disk state to DB
- **`models/document.ts`** — Zod schema that defines the canonical document shape
- **`routes/`** — 8 route files: `documents`, `search`, `bulk`, `import`, `rescan`, `metadata`, `preview`, `export`

### Client (`client/src/`)
- **`types.ts`** — shared interfaces: `Document`, `RescanResult`, `ImportResult`
- **`api.ts`** — typed fetch wrapper; all server calls go through `api.*` methods (`getDocuments`, `uploadDocument`, `bulkDeleteDocuments`, `rescan`, etc.)
- **`contexts/DocumentsContext.tsx`** — global document list state; uses `api.ts`
- **`contexts/ThemeContext.tsx`** — dark/light theme, persisted to localStorage
- **`pages/`** — FrontPage (dashboard stats), DocumentsPage (grid/table), DocumentDetailPage, InboxPage (unsorted docs), SettingsPage, DonatePage
- **`components/`** — Layout, UploadModal, Toast, ThemePicker, Footer

React Router v7 with nested routes under a shared Layout component.

### Database schema
`documents` table has: id, title, description, category, documentType, vendor, amount, currency, documentDate, expiryDate, reminderDate, tags (JSON array), people (JSON array), assets (JSON array), notes, originalFilename, storedFilename, filePath, sidecarPath, checksum, fileSize, createdAt, updatedAt.

Supporting tables: `categories` (16 defaults like Identity, Finance, Housing), `people`, `assets`, `_migrations`.

### Key conventions
- Vault root comes from `config.vaultRoot` (`VAULT_ROOT` env var, default `./vault`) — never hardcode `process.cwd()/vault`
- DB lives at `{vaultRoot}/vaulty.db`; add new schema as a numbered `.sql` file in `db/migrations/`
- All client API calls go through `api.ts` — never raw `fetch` in components
- Filenames are sanitized via `fileUtils.ts` before writing to disk
- SHA256 checksums are used for duplicate detection on upload and import
- `CONCEPT.md` in the repo root is the product spec — check it before adding features to understand intended scope vs. deferred features (OCR, email import, encrypted storage)
