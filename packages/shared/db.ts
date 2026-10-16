import { SQL } from "bun";

export type DocumentStatus = "uploaded" | "failed" | "duplicate";

export interface DocumentRecord {
  id: string; // SHA-256 hash
  source_url: string;
  crawl_id: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  status: DocumentStatus;
  error_message: string | null;
  is_valid_docx: boolean | null;
  discovered_at: string;
  downloaded_at: string | null;
  uploaded_at: string | null;

  // Extraction metadata
  extracted_at: string | null;
  word_count: number | null;
  char_count: number | null;
  table_count: number | null;
  image_count: number | null;
  language: string | null;
  language_confidence: number | null;
  extraction_error: string | null;

  // Embedding data
  embedded_at: string | null;
  embedding_model: string | null;
  embedding: number[] | null;

  // Classification data (clustering)
  cluster_id: number | null;
  cluster_label: string | null;
  classified_at: string | null;

  // LLM classification data
  document_type: string | null;
  document_topic: string | null;
  classification_confidence: number | null;
  classification_model: string | null;
}

export interface ExtractionData {
  id: string;
  word_count: number;
  char_count: number;
  table_count: number;
  image_count: number;
  language: string;
  language_confidence: number;
  extracted_at?: string;
  extraction_error?: string;
}

export interface EmbeddingData {
  id: string;
  embedding: number[];
  embedding_model: string;
  embedded_at?: string;
}

export interface OutcomeKey {
  id: string;
  source_url: string;
  crawl_id: string;
  status: DocumentStatus;
}

export interface DbClient {
  // Scraping
  // Writes one CDX URL's outcome in its crawl, replacing that URL's earlier failed rows.
  recordOutcome(doc: Partial<DocumentRecord> & OutcomeKey): Promise<void>;
  getDocument(id: string): Promise<DocumentRecord | null>;
  getProcessedUrlHashes(opts?: { excludeFailed?: boolean }): Promise<Set<string>>;
  upsertDuplicateBatch(
    records: { id: string; sourceUrl: string; crawlId: string; filename: string }[],
  ): Promise<void>;
  getUrlsForCrawl(crawlId: string): Promise<Set<string>>;
  getStats(): Promise<{ status: string; count: number }[]>;

  // Extraction
  updateExtraction(data: ExtractionData): Promise<void>;
  updateExtractionError(id: string, error: string): Promise<void>;
  getUnextractedDocuments(limit: number): Promise<DocumentRecord[]>;

  // Embedding
  updateEmbedding(data: EmbeddingData): Promise<void>;
  markEmbeddingSkipped(id: string, reason: string): Promise<void>;
  getUnembeddedDocuments(limit: number): Promise<DocumentRecord[]>;

  // Stats
  getLLMClassificationStats(): Promise<{
    classified: number;
    pending: number;
    byType: Record<string, number>;
  }>;
  getExtractionStats(): Promise<{ extracted: number; pending: number; errors: number }>;
  getEmbeddingStats(): Promise<{ embedded: number; pending: number; skipped: number }>;
  getClassificationStats(): Promise<{ classified: number; pending: number; clusters: number }>;

  close(): Promise<void>;
}

async function upsert(sql: SQL, doc: Partial<DocumentRecord> & OutcomeKey) {
  const columns = Object.keys(doc).filter(
    (k) => doc[k as keyof typeof doc] !== undefined && k !== "embedding",
  );
  const values = columns.map((k) => doc[k as keyof typeof doc]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClauses = columns
    .filter((k) => k !== "id")
    .map((key) => `${key} = EXCLUDED.${key}`)
    .join(", ");

  await sql.unsafe(
    `INSERT INTO documents (${columns.join(", ")}) VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClauses}`,
    values as unknown[],
  );
}

export async function createDb(databaseUrl: string): Promise<DbClient> {
  const sql = new SQL({ url: databaseUrl });

  return {
    // ==================== Scraping Methods ====================

    async recordOutcome(doc) {
      await sql.begin(async (tx) => {
        // Serialize captures of the same URL in the same crawl until commit.
        await tx`SELECT pg_advisory_xact_lock(hashtext(${doc.source_url}), hashtext(${doc.crawl_id}))`;
        await tx`
          DELETE FROM documents
          WHERE source_url = ${doc.source_url} AND crawl_id = ${doc.crawl_id}
            AND status = 'failed' AND id <> ${doc.id}
        `;
        if (doc.status === "failed") {
          const [settled] = await tx`
            SELECT 1 FROM documents
            WHERE source_url = ${doc.source_url} AND crawl_id = ${doc.crawl_id}
              AND status <> 'failed'
            LIMIT 1
          `;
          // A failure never replaces or sits beside a success; drop any row under its own ID too.
          if (settled) {
            await tx`DELETE FROM documents WHERE id = ${doc.id} AND status = 'failed'`;
            return;
          }
        }
        await upsert(tx, doc);
      });
    },

    async getDocument(id: string) {
      const rows = await sql<DocumentRecord[]>`
        SELECT * FROM documents WHERE id = ${id}
      `;
      return rows[0] || null;
    },

    async getProcessedUrlHashes(opts?: { excludeFailed?: boolean }) {
      const rows = opts?.excludeFailed
        ? await sql<{ h: string }[]>`
            SELECT md5(source_url) as h FROM documents WHERE status IN ('uploaded', 'duplicate')
          `
        : await sql<{ h: string }[]>`
            SELECT md5(source_url) as h FROM documents
          `;
      return new Set(rows.map((r) => r.h));
    },

    async upsertDuplicateBatch(records) {
      if (records.length === 0) return;
      const values = records
        .map((_, i) => {
          const b = i * 6;
          return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
        })
        .join(", ");
      const params = records.flatMap((r) => [
        r.id,
        r.sourceUrl,
        r.crawlId,
        r.filename,
        "duplicate",
        "cross-crawl duplicate",
      ]);
      await sql.unsafe(
        `INSERT INTO documents (id, source_url, crawl_id, original_filename, status, error_message)
         VALUES ${values}
         ON CONFLICT (id) DO NOTHING`,
        params,
      );
    },

    async getUrlsForCrawl(crawlId: string) {
      const rows = await sql<{ source_url: string }[]>`
        SELECT source_url FROM documents WHERE crawl_id = ${crawlId}
      `;
      return new Set(rows.map((r) => r.source_url));
    },

    async getStats() {
      return sql<{ status: string; count: number }[]>`
        SELECT status, COUNT(*)::int as count FROM documents GROUP BY status
      `;
    },

    // ==================== Extraction Methods ====================

    async updateExtraction(data: ExtractionData) {
      const extractedAt = data.extracted_at || new Date().toISOString();
      await sql`
        UPDATE documents SET
          extracted_at = ${extractedAt},
          word_count = ${data.word_count},
          char_count = ${data.char_count},
          table_count = ${data.table_count},
          image_count = ${data.image_count},
          language = ${data.language},
          language_confidence = ${data.language_confidence},
          extraction_error = NULL
        WHERE id = ${data.id}
      `;
    },

    async updateExtractionError(id: string, error: string) {
      await sql`
        UPDATE documents SET
          extraction_error = ${error}
        WHERE id = ${id}
      `;
    },

    async getUnextractedDocuments(limit: number) {
      // Get docs that haven't been extracted yet (excludes previously failed ones)
      return sql<DocumentRecord[]>`
        SELECT * FROM documents
        WHERE status = 'uploaded'
          AND extracted_at IS NULL
          AND extraction_error IS NULL
        ORDER BY uploaded_at ASC
        LIMIT ${limit}
      `;
    },

    // ==================== Embedding Methods ====================

    async updateEmbedding(data: EmbeddingData) {
      const embeddedAt = data.embedded_at || new Date().toISOString();
      // pgvector expects array as string: '[0.1, 0.2, ...]'
      const embeddingStr = `[${data.embedding.join(",")}]`;
      await sql.unsafe(
        `UPDATE documents SET
          embedded_at = $1,
          embedding_model = $2,
          embedding = $3::vector
        WHERE id = $4`,
        [embeddedAt, data.embedding_model, embeddingStr, data.id],
      );
    },

    async markEmbeddingSkipped(id: string, reason: string) {
      await sql`
        UPDATE documents SET
          embedded_at = ${new Date().toISOString()},
          embedding_model = ${`skipped:${reason}`}
        WHERE id = ${id}
      `;
    },

    async getUnembeddedDocuments(limit: number) {
      return sql<DocumentRecord[]>`
        SELECT * FROM documents
        WHERE extracted_at IS NOT NULL
          AND extraction_error IS NULL
          AND embedded_at IS NULL
        ORDER BY extracted_at ASC
        LIMIT ${limit}
      `;
    },

    // ==================== Stats ====================

    async getLLMClassificationStats() {
      const result = await sql<{ classified: number; pending: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE document_type IS NOT NULL)::int as classified,
          COUNT(*) FILTER (WHERE extracted_at IS NOT NULL AND extraction_error IS NULL AND document_type IS NULL)::int as pending
        FROM documents
      `;

      const byTypeRows = await sql<{ type: string; count: number }[]>`
        SELECT document_type as type, COUNT(*)::int as count
        FROM documents
        WHERE document_type IS NOT NULL
        GROUP BY document_type
      `;

      const byType: Record<string, number> = {};
      for (const row of byTypeRows) {
        byType[row.type] = row.count;
      }

      return {
        classified: result[0].classified,
        pending: result[0].pending,
        byType,
      };
    },

    async getExtractionStats() {
      const result = await sql<{ extracted: number; pending: number; errors: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE extracted_at IS NOT NULL AND extraction_error IS NULL)::int as extracted,
          COUNT(*) FILTER (WHERE status = 'uploaded' AND extracted_at IS NULL)::int as pending,
          COUNT(*) FILTER (WHERE extraction_error IS NOT NULL)::int as errors
        FROM documents
      `;
      return result[0];
    },

    async getEmbeddingStats() {
      const result = await sql<{ embedded: number; pending: number; skipped: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE embedded_at IS NOT NULL AND embedding_model NOT LIKE 'skipped:%')::int as embedded,
          COUNT(*) FILTER (WHERE extracted_at IS NOT NULL AND extraction_error IS NULL AND embedded_at IS NULL)::int as pending,
          COUNT(*) FILTER (WHERE embedding_model LIKE 'skipped:%')::int as skipped
        FROM documents
      `;
      return result[0];
    },

    async getClassificationStats() {
      const result = await sql<{ classified: number; pending: number; clusters: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE classified_at IS NOT NULL)::int as classified,
          COUNT(*) FILTER (WHERE embedded_at IS NOT NULL AND classified_at IS NULL)::int as pending,
          COUNT(DISTINCT cluster_id) FILTER (WHERE cluster_id IS NOT NULL)::int as clusters
        FROM documents
      `;
      return result[0];
    },

    async close() {
      await sql.close();
    },
  };
}
