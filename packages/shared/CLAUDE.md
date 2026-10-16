# @docx-corpus/shared

Shared utilities for the Bun pipeline (scraper, extractor, embedder, CLI). The API, site, and Lambda do not use it.

## What's here

- **`db.ts`** — `DbClient` interface and `createDb()` factory. Uses `Bun.sql` (not pg/postgres.js). Scrape, extract, and embed write through this client; `classify` only reads stats (Python writes the labels).
- **`storage/`** — `Storage` interface with `createR2Storage()` and `createLocalStorage()`. Abstracts Cloudflare R2 vs local filesystem.
- **`ui.ts`** — Terminal formatting helpers (progress bars, headers, multi-line progress).
- **`index.ts`** — Barrel exports.

## Key types

- `DocumentRecord` — the full row from the `documents` table. Every pipeline stage adds columns to this.
- `DbClient` — interface with methods grouped by pipeline stage (scraping, extraction, embedding, stats).

## When modifying

- Adding a new pipeline stage? Add fields to `DocumentRecord`, add methods to `DbClient` interface AND the `createDb()` implementation.
- DB uses tagged template literals (`sql\`...\``) for parameterized queries. Use `sql.unsafe()` only when dynamic column names are needed.
- Don't add external dependencies — this package only depends on Bun built-ins and `@aws-sdk/client-s3`.
