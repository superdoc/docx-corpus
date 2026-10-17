-- Migration 009: drop embeddings and clustering
--
-- Nothing reads these columns. Embeddings (gemini-embedding-001) cover about
-- 10% of documents and were last written 2026-01-23; clustering ran once.
-- Their indexes are dropped with the columns. If the lock times out, rerun it.
--
-- DROP COLUMN does not shrink the table on disk. Run VACUUM FULL documents
-- afterwards to reclaim the space; it locks the table while it runs.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE documents
  DROP COLUMN IF EXISTS embedding,
  DROP COLUMN IF EXISTS embedding_model,
  DROP COLUMN IF EXISTS embedded_at,
  DROP COLUMN IF EXISTS cluster_id,
  DROP COLUMN IF EXISTS cluster_label,
  DROP COLUMN IF EXISTS classified_at;

DROP EXTENSION IF EXISTS vector;
COMMIT;
