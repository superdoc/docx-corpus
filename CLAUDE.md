# docx-corpus

The largest open corpus of .docx files (~800K documents) for document processing research. Built by [SuperDoc](https://superdoc.dev) — DOCX editing and tooling.

## Architecture

This is a **data pipeline monorepo** with two runtimes:

- **TypeScript (Bun)** — infrastructure: scraping, extraction, embedding
- **Python** — data science: classification, export, publishing

```
apps/cli/               → corpus <command> (cdx-filter, scrape, extract, embed, classify, export, status)
apps/cdx-filter/        → AWS Lambda for Common Crawl CDX filtering
apps/api/               → Cloudflare Worker for api.docxcorp.us (own bun.lock, not a workspace)
apps/site/              → Static Astro site for docxcorp.us
packages/shared/        → DB client (Bun.sql), R2 storage, UI helpers
packages/scraper/       → Downloads .docx from Common Crawl WARC archives
packages/extractor/     → Text extraction via Docling
packages/embedder/      → Embeddings via Google gemini-embedding-001
scripts/classification/ → ML classification pipeline (Python)
scripts/*.py            → HF export and one-off WARC trailing-bytes repair
db/                     → PostgreSQL schema + migrations
```

## Pipeline

Each stage writes to the same PostgreSQL database (`documents` table):

1. **Scrape** (TS) — Common Crawl → .docx files in R2 (`status = 'uploaded'`)
2. **Extract** (TS) — Docling → text in R2 (`extracted_at`, `word_count`, `language`)
3. **Embed** (TS) — Google API → pgvector (`embedding`, `embedded_at`)
4. **Classify** (Python) — XLM-RoBERTa → labels (`document_type`, `document_topic`)

## Scraper deduplication

The scraper maintains **exact parity** between CDX URLs and database records: every URL in a crawl's CDX files has exactly one record in the `documents` table under that `crawl_id`.

### Document statuses

- `uploaded` — valid .docx saved to R2, ID is `{contentHash}`
- `failed` — WARC download failed or content is invalid docx, ID is `failed-{sha256(url+crawlId)}`
- `duplicate` — same content already exists under a different URL, ID is `dup-{sha256(url+crawlId)}`

### ID scheme

IDs are content-addressed for storage mapping (`documents/{id}.docx`):

| Scenario | ID | Reason |
|---|---|---|
| Uploaded | `{sha256(content)}` | Maps to R2 storage key |
| Download or validation failed | `failed-{sha256(url+crawlId)}` | Nothing is stored, so scope per URL and crawl; a shared ID would overwrite another URL's or crawl's record |
| Content duplicate | `dup-{sha256(url+crawlId)}` | Scoped per crawl so each crawl keeps its own dup record |

Rows written before this scheme may use `failed-{sha256(url)}` or `{sha256(content)}` with `status = 'failed'`.

### Dedup paths

The scraper handles three dedup scenarios in order:

1. **URL-dedup** (instant, no download) — URL already in `processedHashes` Set (md5 hashes loaded from all crawls at startup). Includes uploaded, duplicate, AND failed URLs by default. If the URL exists under a different `crawl_id`, creates a cross-crawl `duplicate` record under the current crawl. If already under the current crawl, silently skips.

2. **Content-dedup** (requires WARC download) — URL is new but content hash matches an existing document. Creates a `duplicate` record pointing to the original.

3. **Same-URL retry** (within same crawl) — Same URL appears multiple times in CDX files (different WARC captures). After a successful WARC download, the URL is added to `processedHashes` so subsequent entries are skipped.

### Stale record cleanup

Each attempt's outcome is written by `recordOutcome` in one transaction, under an advisory lock on the URL and crawl. It deletes that URL's other `failed` rows in the crawl, matched by `source_url` and `crawl_id` so older ID formats go too, and then writes the outcome. A failure is not written if the URL already has a non-failed row in the crawl. An earlier failure stays until its replacement commits, and a failure never sits beside a success for the same URL and crawl. Failed records in other crawls are kept.

Known gaps: two successful captures of one URL with different bytes still leave two `uploaded` rows; `upsertDuplicateBatch` writes cross-crawl duplicates without this lock; and an `uploaded` row's ID is its content hash, so the same URL and content uploaded again in a later crawl (with `--force`) moves the row to that crawl.

### Re-run safety

Running the scraper on the same crawl again is safe:
- `--force`: re-downloads everything from scratch
- `--retry-failed`: re-downloads only previously failed URLs
- Default: all known URLs (uploaded + duplicate + failed) are skipped instantly

## Database

Single `documents` table in PostgreSQL (NeonDB) with pgvector. All pipeline stages write to this table.

- **Connection**: `DATABASE_URL` env var (Bun.sql for TS, psycopg2 for Python)
- **Schema**: `db/schema.sql` (canonical), `db/migrations/` (incremental)
- **Key columns**: `id` (SHA-256 hash), `status`, `extracted_at`, `embedded_at`, `document_type`, `document_topic`

## Storage

Documents and extracted text live in Cloudflare R2:
- `documents/{hash}.docx` — original files
- `extracted/{hash}.txt` — extracted text

Text is also available at `https://docxcorp.us/extracted/{id}.txt`.

## Commands

```bash
bun install                        # Install TS dependencies
bun run corpus scrape --crawl 3    # Scrape from Common Crawl
bun run corpus extract             # Extract text
bun run corpus embed               # Generate embeddings
bun run corpus status              # Show pipeline stats
```

## Key conventions

- Use `bun` for all TS tooling (not node/npm/pnpm)
- DB client is in `packages/shared/db.ts` — the TS stages (scrape, extract, embed) use `DbClient`; Python writes classifications with psycopg2
- Storage abstraction in `packages/shared/storage/` — R2 or local
- Environment: `.env` at project root (gitignored), see `.env.example`
- Python deps: `pyproject.toml` for classification and the extractor; standalone `scripts/*.py` declare inline `uv run` deps
