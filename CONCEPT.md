## Vaulty — personal document vault

**Vaulty** is a self-hosted personal document vault for storing, organising, searching, and tracking important documents while keeping every document as a real file on disk.

It is not just a file browser, and it is not a black-box document database. Vaulty keeps PDFs, images, scans, receipts, contracts, manuals, certificates, and official letters in a normal folder-based vault, then adds structured metadata, categories, tags, relationships, reminders, warranties, notes, and search around them.

## Short description

**Vaulty**
Self-hosted personal document vault that keeps files on disk with searchable metadata, tags, reminders, and sidecars.

## Medium description

**Vaulty** is a self-hosted document vault for organising important personal files. Upload or import PDFs, scans, receipts, contracts, warranties, manuals, certificates, and official letters into a real folder-based vault, then enrich them with categories, tags, people, assets, dates, reminders, notes, and portable `.vaulty.json` sidecar metadata.

## Full description

**Vaulty** is a self-hosted personal document vault for managing important household and personal records while keeping every document as a normal file on disk. It helps organise documents such as receipts, invoices, warranties, insurance papers, employment contracts, tax records, manuals, certificates, medical papers, school documents, official letters, and other important files.

Each document can be enriched with structured metadata, tags, notes, dates, related people, related assets, vendors, warranty information, expiry dates, and reminder rules. Instead of relying on folders and filenames alone, Vaulty gives each file useful context: what it is, who it belongs to, what item or topic it relates to, when it expires, where the original file lives, and what action may be needed later.

Vaulty does not trap documents inside a database. Original files remain accessible as regular PDFs, images, documents, or scans that can be browsed, copied, backed up, restored, or migrated without the app. A lightweight database stores the searchable index and relationships, while `.vaulty.json` sidecar files keep metadata portable alongside the documents themselves.

The result is a private, local-first document archive that combines the safety and portability of normal files with the structure of a searchable personal records system.

## Core purpose

Vaulty should help answer questions like:

```text
Where is that warranty?
When does this contract expire?
Which documents relate to my car?
Do I still have the receipt for this appliance?
What documents do I have for Lukas?
Which policies renew this year?
Which official papers are missing?
What did I pay for this item?
Which documents need action soon?
Which files are missing, duplicated, or not yet organised?
```

## Storage principle

**Files remain files. Vaulty adds structure around them.**

Vaulty stores documents as regular files in a configured vault folder. The database stores metadata, indexes, relationships, app state, and search data only.

Example vault structure:

```text
/vault
  /documents
    /2026
      /05
        2026-05-10_elgiganten_dishwasher_receipt.pdf
        2026-05-10_elgiganten_dishwasher_receipt.vaulty.json
  /thumbnails
  /exports
  /imports
  /vaulty.db
```

The document file remains a real file:

```text
2026-05-10_elgiganten_dishwasher_receipt.pdf
```

The sidecar keeps portable metadata:

```text
2026-05-10_elgiganten_dishwasher_receipt.vaulty.json
```

## What Vaulty stores in the database

```text
Title
Description
Category
Document type
Tags
Related people
Related assets
Vendor/company
Amount and currency
Document date
Expiry date
Reminder date
Warranty metadata
Notes
OCR/search text
File path
Original filename
Stored filename
Checksum
File size
Preview thumbnail path
Linked document relationships
Activity history
```

## What Vaulty does not store in the database

The actual document files should not be stored as database blobs.

```text
PDF contents
Image files
Scanned files
Original uploads
Manuals
Receipts
Certificates
Contracts
```

Those stay on disk as real files.

## Main document types

Vaulty should support many types of important personal and household documents.

```text
Receipts
Invoices
Warranty cards
Manuals
Insurance policies
Rental agreements
Mortgage documents
Employment contracts
Salary letters
Tax documents
Bank letters
Loan documents
Medical papers
School documents
Birth certificates
Passports
Official letters
Vehicle documents
Repair invoices
Service records
Travel documents
Certificates
```

## Main pages

### Dashboard

The dashboard should focus on attention and overview.

Suggested sections:

```text
Recently added
Needs action
Expiring soon
Missing files
Possible duplicates
Missing metadata
Important documents
Document categories
Storage summary
```

Example dashboard cards:

```text
Documents: 438
Needs action: 6
Expiring soon: 3
Missing files: 1
Possible duplicates: 2
Missing metadata: 22
Warranties active: 18
Recently added: 12
```

### Documents page

The main document library.

Views:

```text
Grid view
Table view
Timeline view
Category view
```

Filters:

```text
Category
Document type
Person
Asset
Vendor/company
Year
Tags
Expiry date
Warranty status
Needs action
Missing metadata
Missing file
Duplicate status
File type
```

Useful sorting:

```text
Newest added
Oldest added
Document date
Expiry date
Title
Category
Vendor
Missing metadata first
Expiring soon first
```

### Document detail page

Each document detail page should show both the human context and the real file information.

Core details:

```text
Preview
Title
Category
Document type
Description
Tags
Notes
Document date
Added date
Expiry date
Reminder date
Related people
Related assets
Vendor/company
Amount
Currency
Linked documents
Activity/history
```

File details:

```text
File path
Original filename
Current filename
File type
File size
Checksum
Added date
Last modified date
Sidecar path
Open file
Download file
Copy path
```

Example:

```text
Dishwasher receipt

Category: Purchases
Type: Receipt
Vendor: Elgiganten
Amount: 4,299 DKK
Purchase date: 2026-05-10
Warranty expires: 2028-05-10
Related asset: Bosch dishwasher
Tags: kitchen, appliance, warranty

File:
Path: /vault/documents/2026/05/2026-05-10_elgiganten_dishwasher_receipt.pdf
Original name: IMG_4928.pdf
Sidecar: /vault/documents/2026/05/2026-05-10_elgiganten_dishwasher_receipt.vaulty.json
```

### Inbox

New or unsorted documents should go to an Inbox first.

Inbox behavior:

```text
New uploads go to Inbox by default
Inbox count is visible in navigation
Documents leave Inbox when category/type is set
Bulk edit from Inbox
Missing metadata is highlighted
```

### Categories

Default categories:

```text
Identity
Family
Housing
Finance
Employment
Insurance
Health
Vehicles
Purchases
Warranties
Manuals
Education
Tax
Legal
Travel
Other
```

### People

Documents can be linked to people.

Examples:

```text
Lars
Maria
Lukas
Household
```

Useful views:

```text
All documents for Lukas
All documents for Maria
All household documents
Documents not assigned to anyone
```

### Assets

Documents can be linked to real-world assets.

Examples:

```text
Car
Bike
House
Apartment
Phone
Laptop
Dishwasher
Washing machine
Router
Camera
Baby stroller
```

Example asset page:

```text
Bosch dishwasher

Purchase date: 2026-05-10
Warranty until: 2028-05-10
Serial number: SN123456
Location: Kitchen

Documents:
- Receipt
- Warranty card
- User manual
- Repair invoice
```

### Warranties

A dedicated warranty view should show:

```text
Active warranties
Expiring soon
Expired warranties
Missing receipt
Missing serial number
Related assets
Claim instructions
```

Warranty fields:

```text
Product name
Vendor
Purchase date
Warranty length
Warranty expiry date
Receipt document
Manual document
Serial number
Claim instructions
```

### Saved views

Default saved views:

```text
Inbox
Needs action
Expiring soon
Missing files
Possible duplicates
Warranties
Receipts
Insurance
Tax documents
Documents for Lukas
Missing metadata
Recently added
Archived
```

## Search

Search should cover both metadata and document content when available.

Search sources:

```text
Document title
Description
Tags
Category
Vendor
Notes
OCR text
Filename
People
Assets
Amounts
Dates
```

Example searches:

```text
dishwasher
elgiganten
tax 2025
passport
insurance car
warranty expires 2026
documents for Lukas
receipts over 1000 DKK
```

## Sidecar `.vaulty.json` metadata files

Sidecars are part of the MVP.

Every managed document should have a `.vaulty.json` metadata file next to it.

Example:

```text
2026-05-10_elgiganten_dishwasher_receipt.pdf
2026-05-10_elgiganten_dishwasher_receipt.vaulty.json
```

Example sidecar:

```json
{
  "vaultyVersion": 1,
  "documentId": "doc_abc123",
  "title": "Dishwasher receipt",
  "category": "Purchases",
  "documentType": "Receipt",
  "vendor": "Elgiganten",
  "documentDate": "2026-05-10",
  "amount": 4299,
  "currency": "DKK",
  "tags": ["appliance", "warranty", "kitchen"],
  "people": [],
  "assets": ["Bosch dishwasher"],
  "expiryDate": "2028-05-10",
  "reminderDate": "2028-04-10",
  "notes": "Receipt for dishwasher purchase.",
  "originalFilename": "IMG_4928.pdf",
  "storedFilename": "2026-05-10_elgiganten_dishwasher_receipt.pdf",
  "checksum": "sha256:...",
  "createdAt": "2026-05-10T12:00:00Z",
  "updatedAt": "2026-05-10T12:00:00Z"
}
```

Sidecar behavior:

```text
Create sidecar when a document is added
Update sidecar when metadata changes
Read sidecar during import/rescan
Warn if sidecar and database metadata differ
Allow sidecars to be regenerated from the database
Allow database index to be rebuilt from sidecars
```

## Configurable folder organisation

Vaulty should let the user decide how documents are placed inside the vault.

Folder organisation modes:

```text
By year/month
By category/year
By person/category
By asset/category
Flat inbox then manual move
Keep imported folder structure
Custom pattern
```

Suggested default:

```text
/vault/documents/{year}/{month}/{filename}
```

Example:

```text
/vault/documents/2026/05/2026-05-10_elgiganten_dishwasher_receipt.pdf
```

Custom pattern example:

```text
/vault/documents/{category}/{year}/{vendor}/{filename}
```

Supported placeholders:

```text
{year}
{month}
{category}
{documentType}
{person}
{asset}
{vendor}
{title}
{originalFilename}
{filename}
```

Folder rules:

```text
Preview destination path before saving
Prevent invalid path characters
Avoid overwriting existing files
Update sidecars when files are moved
Keep move history in metadata
Detect when files were moved outside Vaulty
```

## Safe filename generator

Vaulty should generate readable, safe filenames.

Suggested format:

```text
YYYY-MM-DD_vendor_title_type.ext
```

Example:

```text
2026-05-10_elgiganten_dishwasher_receipt.pdf
```

Filename rules:

```text
Use lowercase by default
Replace spaces with hyphens or underscores
Remove unsafe characters
Limit filename length
Preserve file extension
Avoid duplicate names
Support Danish characters safely or transliterate them
Append counter if needed
Never overwrite an existing file
```

Duplicate filename example:

```text
2026-05-10_elgiganten_dishwasher_receipt.pdf
2026-05-10_elgiganten_dishwasher_receipt-2.pdf
2026-05-10_elgiganten_dishwasher_receipt-3.pdf
```

User options during upload/import:

```text
Keep original filename
Use suggested safe filename
Edit filename manually
Apply naming choice to all selected files
```

## Duplicate detection by checksum

Vaulty should calculate a SHA-256 checksum for every imported file.

Duplicate detection should happen during:

```text
Upload
Folder import
Vault rescan
Manual metadata refresh
```

Duplicate states:

```text
Exact duplicate
Same filename, different content
Same checksum, different filename
Possible duplicate
```

Duplicate handling options:

```text
Skip import
Open existing document
Link to existing document
Import anyway
Replace existing file
Keep both
```

Recommended default:

```text
Skip import and show existing document
```

Example warning:

```text
This file already exists in Vaulty.

Existing document:
Dishwasher receipt
Path: /vault/documents/2026/05/2026-05-10_elgiganten_dishwasher_receipt.pdf

Options:
Skip
Open existing
Import as separate document
```

## Missing file detection

Because Vaulty stores real files, it needs to handle files being moved, renamed, or deleted outside the app.

Missing file detection should run during:

```text
Dashboard load
Vault rescan
Document detail open
Manual integrity check
```

Missing file states:

```text
OK
Missing file
Missing sidecar
Sidecar orphaned
Database record orphaned
Checksum mismatch
File moved candidate
```

If a file is missing, Vaulty should:

```text
Mark document as missing
Show warning on dashboard
Keep metadata intact
Allow user to locate file manually
Search vault for matching checksum
Search vault for matching sidecar documentId
Allow record to be archived or removed
```

Example warning:

```text
Missing file

Vaulty still has metadata for this document, but the file is no longer present at:

/vault/documents/2026/05/receipt.pdf

Possible actions:
Locate file
Search vault
Mark as archived
Remove record
```

## Vault rescan

Vault rescan is part of the MVP.

The rescan should detect:

```text
New files without database records
Files missing from disk
Sidecars without documents
Documents without sidecars
Moved files
Renamed files
Duplicate checksums
Checksum mismatches
Metadata differences between database and sidecar
```

Rescan result page:

```text
New files found: 12
Missing files: 2
Moved/renamed candidates: 3
Duplicate files: 1
Missing sidecars: 5
Metadata conflicts: 4
```

Rescan actions:

```text
Import new files
Regenerate missing sidecars
Update database paths
Resolve metadata conflicts
Ignore selected
Delete orphaned records
```

## Upload and import flow

### Upload new document

```text
1. User uploads receipt.pdf
2. Vaulty calculates SHA-256 checksum
3. Vaulty checks for duplicates
4. User enters or accepts suggested metadata
5. Vaulty generates safe filename
6. Vaulty previews destination path
7. Vaulty copies file into vault folder
8. Vaulty writes .vaulty.json sidecar
9. Vaulty writes metadata to SQLite index
10. Document appears in library
```

### Import existing folder

```text
1. User selects/imports a folder
2. Vaulty scans supported files
3. Vaulty calculates checksums
4. Vaulty reads any existing .vaulty.json files
5. Vaulty detects duplicates and already-indexed files
6. User chooses copy, move, or reference mode
7. Vaulty indexes selected files
8. Missing sidecars are generated
9. Documents appear in Inbox or assigned categories
```

### Database recovery

```text
1. SQLite database is lost or reset
2. User points Vaulty at existing vault folder
3. Vaulty scans documents
4. Vaulty reads .vaulty.json sidecars
5. Vaulty rebuilds the document index
6. Documents, metadata, tags, dates, assets, and notes are restored
```

## Bulk actions

Bulk editing should be included because document organisation often happens in batches.

Bulk actions:

```text
Assign category
Assign type
Add tags
Remove tags
Set person
Set asset
Set year
Move to archive
Regenerate filenames
Regenerate sidecars
Delete
Export selected
Mark as reviewed
```

## Export and backup

Because files are real files, exports should preserve that.

Export options:

```text
Full vault export
Metadata-only export
Selected documents export
Category export
CSV index
JSON metadata
ZIP with files and metadata
```

Example exports:

```text
Export all tax 2025 documents
Export all car documents
Export all documents for accountant
Export all documents for Lukas
Export all warranties
```

A full vault backup should be understandable outside the app:

```text
/vault/documents
/vault/vaulty.db
/vault/**/*.vaulty.json
/vault/exports
```

## MVP feature list

The MVP should include:

```text
Document upload
Real-file vault storage
Sidecar .vaulty.json metadata files
Configurable folder organisation
Safe filename generator
Duplicate detection by SHA-256 checksum
Missing file detection
Vault rescan
Inbox for unsorted documents
Document library
Document detail page
Categories
Tags
People
Assets
Expiry/reminder dates
Warranty fields
Search by metadata
File preview
Bulk edit
Import existing folder
Open/download original files
JSON metadata export
Full export with original files
Basic dashboard
Settings
Donate
```

## Deferred features

These can come after the MVP:

```text
OCR
AI metadata extraction
Watched folder import
Advanced permissions
Encrypted file storage
Automatic email import
Calendar export
Advanced audit log
Document versioning
Mobile document scanner mode
External sharing links
```

## Final MVP definition

**Vaulty MVP** is a self-hosted personal document vault that stores documents as real files on disk, adds searchable metadata and portable `.vaulty.json` sidecars, organises files into configurable folders, generates safe filenames, detects duplicates by checksum, warns when files go missing, and helps manage important documents through categories, tags, people, assets, warranties, reminders, search, import, export, and bulk editing.

**Your documents stay as normal files. Vaulty adds structure without taking ownership away from you.**
