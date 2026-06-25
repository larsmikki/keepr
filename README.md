# Keepr

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-larsmikki%2Fkeepr-blue?logo=docker)](https://hub.docker.com/r/larsmikki/keepr)
[![Node 20](https://img.shields.io/badge/Node-20-brightgreen?logo=node.js)](https://nodejs.org/)

**Keepr** is a self-hosted personal file vault. Files stay as real files on disk with portable `.sidecar.json` sidecars and an indexed SQLite database for search — no proprietary blobs, no cloud, no lock-in. Drop the vault on any disk and Keepr can rebuild its index from the sidecars.

## Features

- **Files-on-disk storage** — documents live at `vault/documents/{year}/{month}/{safe_filename}`, exactly where you can read them yourself
- **Sidecar metadata** â€” every file has a `.sidecar.json` next to it so the DB can be rebuilt from disk at any time
- **Full-text search** â€” across titles, descriptions, vendors, tags, and notes
- **Rich metadata** â€” categories, document types, vendor, amounts, dates, tags, people, assets, reminders
- **Inbox** â€” unsorted uploads land in an inbox until you file them
- **Rescan** â€” detects new, missing, moved, or duplicate files between disk and DB
- **Bulk operations** â€” categorize, tag, or delete multiple documents at once
- **Reminders** â€” expiry and reminder dates for warranties, contracts, IDs, etc.
- **Import / export** â€” backup as a single archive, restore on any machine
- **SHA256 checksums** â€” duplicate detection on upload and import
- **Themes** â€” light and dark
- **No accounts, no telemetry** â€” your data stays on your machine

## Getting started

Pick whichever install path matches your setup. All paths land on [http://localhost:3110](http://localhost:3110).

### 1. Docker (Docker Desktop, NAS, or any Docker server)

Works on Synology, Unraid, TrueNAS, QNAP, Proxmox, or a plain Docker host.

```bash
docker run -d \
  --name keepr \
  -p 3110:3110 \
  -v keepr_data:/app/vault \
  --restart unless-stopped \
  larsmikki/keepr:latest
```

Or with Compose:

```yaml
services:
  keepr:
    image: larsmikki/keepr:latest
    container_name: keepr
    ports:
      - "3110:3110"
    environment:
      - PORT=3110
    volumes:
      - keepr_data:/app/vault
    restart: unless-stopped

volumes:
  keepr_data:
```

To keep the vault on a host folder you can browse directly (recommended), bind-mount instead of using a named volume:

```yaml
volumes:
  - /home/user/Documents/Keepr:/app/vault
```

### 2. Local install on Windows

Requires [Git for Windows](https://git-scm.com/download/win) and [Node.js 20+](https://nodejs.org/).

```powershell
git clone https://github.com/larsmikki/keepr.git
cd keepr
npm install
npm run dev
```

Client at http://localhost:3110, API at http://localhost:3111. For a production build:

```powershell
npm run build
npm start
```

### 3. Local install on macOS

```bash
brew install node git
git clone https://github.com/larsmikki/keepr.git
cd keepr
npm install
npm run dev
```

For a production build: `npm run build && npm start`.

### 4. Local install on Linux

Debian/Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

git clone https://github.com/larsmikki/keepr.git
cd keepr
npm install
npm run dev
```

On Fedora/RHEL use `dnf install nodejs git`; on Arch use `pacman -S nodejs npm git`.

For a production build: `npm run build && npm start`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3110` (prod) / `3111` (dev API) | Port the server listens on |
| `VAULT_ROOT` | `./vault` (dev) / `/app/vault` (Docker) | Directory holding `documents/` and `data.db` |

## Data layout

```
vault/
  data.db                  # SQLite index (rebuildable from sidecars)
  documents/
    2026/
      05/
        2026-05-21_acme_invoice_receipt.pdf
        2026-05-21_acme_invoice_receipt.pdf.sidecar.json
```

The `.sidecar.json` files are the source of truth — if the database is lost, run **Settings → Rescan** to rebuild it from the files on disk.

## Usage

| Action | How |
|--------|-----|
| Upload a document | Click **Upload** and drop a file |
| Edit metadata | Open a document → edit fields inline |
| File from inbox | Open **Inbox** → assign category and metadata |
| Bulk update | Select multiple cards → toolbar appears |
| Find missing/moved files | **Settings → Rescan** |
| Backup | **Settings → Export** |
| Restore | **Settings → Import** |
| Change theme | **Settings → Themes** |

## Tests

```bash
npm test
```

## License

[MIT](LICENSE)

## Support

If Keepr saves you time, consider [buying me a coffee](https://buymeacoffee.com/larsmikki) or [donating via PayPal](https://paypal.me/larsmikki). It helps keep the project free and maintained.


