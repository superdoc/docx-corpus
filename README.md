<p align="center">
  <img src="https://docxcorp.us/apple-touch-icon.png" width="80" height="80" alt="docx-corpus">
</p>

<h1 align="center">docx-corpus</h1>

<p align="center">
  736K+ real Word documents from the public web, classified and open.
  <br>
  Built by <a href="https://superdoc.dev">SuperDoc</a> · <a href="https://docxcorp.us">docxcorp.us</a> · <a href="https://huggingface.co/datasets/superdoc-dev/docx-corpus">Hugging Face</a> · <a href="https://api.docxcorp.us/stats">API</a>
</p>

<p align="center">
  <a href="https://github.com/superdoc/docx-corpus/releases"><img src="https://img.shields.io/github/v/release/superdoc/docx-corpus?filter=cli-v*&label=cli" alt="CLI"></a>
  <a href="https://github.com/superdoc/docx-corpus/releases"><img src="https://img.shields.io/github/v/release/superdoc/docx-corpus?filter=cdx-filter-v*&label=cdx-filter" alt="CDX Filter"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

> [!IMPORTANT]
> Documents scraped before [`477d1b9`](https://github.com/superdoc/docx-corpus/commit/477d1b9) can end with 4 extra bytes after the ZIP data, which makes Word for Mac report unreadable content ([#8](https://github.com/superdoc/docx-corpus/issues/8)). New scrapes are fixed. To check or repair older local copies, run `python3 scripts/fix_trailing_warc_bytes.py`.

## Get the data

```bash
# Corpus stats
curl https://api.docxcorp.us/stats

# Find documents by type, topic, language, and minimum confidence
curl "https://api.docxcorp.us/documents?type=legal&lang=en&min_confidence=0.8"

# Download a filtered set
curl "https://api.docxcorp.us/manifest?type=legal&lang=en" -o manifest.txt
wget -i manifest.txt -P ./corpus/
```

## Pipeline

```
Common Crawl → cdx-filter → scrape → extract → classify → export
```

1. **cdx-filter**: an AWS Lambda finds `.docx` URLs in Common Crawl's indexes.
2. **scrape**: downloads each file, validates it, deduplicates it, and stores it in R2.
3. **extract**: extracts text with Docling and detects the language with lingua.
4. **classify**: labels type and topic with fine-tuned XLM-RoBERTa models.
5. **export**: publishes the metadata to Hugging Face as Parquet.

## Quick start

Requires [Bun](https://bun.sh) and Docker.

```bash
bun install
cp .env.example .env
docker compose up -d       # Local Postgres
bun run corpus status      # Pipeline stats
```

## Commands

```bash
bun run corpus cdx-filter --latest 1      # Filter the newest crawl not yet filtered
bun run corpus crawls                     # List filtered crawls in R2
bun run corpus scrape --crawl 3           # Scrape the latest 3 crawls
bun run corpus scrape --retry-failed      # Retry failed URLs in the latest crawl
bun run corpus extract                    # Extract text from pending documents
bun run corpus classify                   # Classify pending documents
bun run corpus classify --modal           # Classify on Modal GPUs
bun run corpus export --push              # Push to Hugging Face
bun run corpus status                     # Show pipeline stats
```

Run `bun run corpus <command> --help` for every option.

## Configuration

Set these in `.env`. See [`.env.example`](.env.example) for the rest.

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Every command |
| `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | `scrape`, `crawls`, and `cdx-filter` without `--crawl`. Without them, `extract` uses `STORAGE_PATH` (default `./corpus`). |
| `AWS_PROFILE` or `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | `cdx-filter`. Needs `lambda:InvokeFunction` on the `cdx-filter` function. |
| `ANTHROPIC_API_KEY` | Labeling training data for classification |

## Development

```bash
bun run lint
bun run typecheck
bun test
```

The scraper's database tests run only when `TEST_DATABASE_URL` is set. They delete every row in `documents`, so point it at a separate database:

```bash
docker exec docx-corpus-postgres-1 createdb -U postgres docx_corpus_test 2>/dev/null || true
docker exec -i docx-corpus-postgres-1 psql -U postgres -d docx_corpus_test < db/schema.sql
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/docx_corpus_test bun test
```

| Path | What |
|---|---|
| `apps/cli` | The `corpus` command |
| `apps/cdx-filter` | Lambda that filters Common Crawl indexes ([deploy](apps/cdx-filter/README.md)) |
| `apps/api` | Cloudflare Worker for api.docxcorp.us |
| `apps/site` | Static Astro site for docxcorp.us |
| `packages/*` | Scraper, extractor, and shared database and storage code |
| `scripts/classification` | Classifier training and inference ([details](scripts/classification/README.md)) |
| `scripts/export-hf.py` | Hugging Face export |
| `db/schema.sql` | Postgres schema; `db/migrations/` for existing databases |

## Docker

The image idles so you can `docker exec` into it for long runs. Its `.env` needs a `DATABASE_URL` the container can reach (`localhost` is the container itself). Without R2 credentials, `extract` uses `/app/corpus`, so mount a volume there.

```bash
docker build -t docx-corpus .
docker run -d --name docx-corpus --env-file .env -v "$PWD/corpus:/app/corpus" docx-corpus
docker exec -it docx-corpus bun run corpus scrape --crawl 3
```

## Takedown requests

If you own a document and want it removed, email [help@docxcorp.us](mailto:help@docxcorp.us) with its hash or URL and proof of ownership. Requests are processed within 7 days.

## License

MIT
