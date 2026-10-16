-- Re-key failed rows that use a raw content hash as their ID.
--
-- Older scrapes and a March 2026 backfill stored failed rows under sha256(content),
-- the same ID an uploaded row for those bytes would use. A later upload of the same
-- bytes then overwrote the failed row of another URL or crawl. Moving them to the
-- scraper's failed-{sha256(url + crawlId)} ID removes the shared key.
--
-- Checked on 2026-10-16 against production: 27,932 rows, no target ID already
-- exists, and no URL and crawl has more than one such row.
--
-- Run it with no scrape in progress, before deploying a scraper that looks up only
-- uploaded rows for content dedup: an overlapping retry can leave a failed and an
-- uploaded row for one URL. Safe to rerun.

UPDATE documents
SET id = 'failed-' || encode(sha256(convert_to(source_url || crawl_id, 'UTF8')), 'hex')
WHERE status = 'failed' AND id ~ '^[0-9a-f]{64}$';
