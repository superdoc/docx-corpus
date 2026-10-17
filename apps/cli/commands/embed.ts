import { type EmbedConfig, processEmbeddings } from "@docx-corpus/embedder";
import { createDb, loadDatabaseUrl, loadStorage } from "@docx-corpus/shared";
import { parseFlags, positiveInt } from "../flags";

const HELP = `
corpus embed - Generate embeddings for extracted documents

Usage
  corpus embed [options]

Reads extracted text from storage and writes embeddings to the database.
Storage is auto-selected based on environment:
  - With R2 credentials: reads from r2://extracted/
  - Without R2 credentials: reads from ./corpus/extracted/

Embedding progress is tracked in the database (embedded_at column).

Model
  Uses Google's gemini-embedding-001 (3072 dimensions, ~$0.006/1M tokens)
  Documents are chunked (6000 chars) and embeddings are combined via weighted average.

Options
  --batch, -b <n>         Limit to n documents (default: all)
  --verbose, -v           Show detailed progress
  --help, -h              Show this help

Environment Variables
  DATABASE_URL            PostgreSQL connection string (required)
  GOOGLE_API_KEY          Google AI API key (required)
  STORAGE_PATH            Local storage path (default: ./corpus)
  CLOUDFLARE_ACCOUNT_ID   Cloudflare account ID (enables R2)
  R2_ACCESS_KEY_ID        R2 access key
  R2_SECRET_ACCESS_KEY    R2 secret key
  R2_BUCKET_NAME          R2 bucket (default: docx-corpus)
  EMBED_INPUT_PREFIX      Input prefix (default: extracted)

Examples
  corpus embed                        # Embed all documents
  corpus embed -b 100 -v              # Limit to 100, verbose output
`;

export async function runEmbed(args: string[]) {
  const flags = parseFlags(args, HELP, {
    batch: { type: "string", short: "b" },
    verbose: { type: "boolean", short: "v", default: false },
  });
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("Error: GOOGLE_API_KEY environment variable is required");
    process.exit(1);
  }

  const { storage, location } = loadStorage();
  const db = await createDb(loadDatabaseUrl());

  const config: EmbedConfig = {
    db,
    storage,
    apiKey,
    inputPrefix: process.env.EMBED_INPUT_PREFIX || "extracted",
    limit: positiveInt(flags.batch, "--batch"),
    concurrency: positiveInt(process.env.EMBED_CONCURRENCY || undefined, "EMBED_CONCURRENCY") ?? 20,
  };

  console.log("Document Embedder");
  console.log("=================");
  console.log(`Storage: ${location}`);
  console.log(`Input:   ${config.inputPrefix}/`);
  console.log(`Output:  database (embedding column)`);
  console.log(`Model:   gemini-embedding-001 (3072 dims)`);
  console.log(`Batch:   ${config.limit ?? "all"}`);
  console.log(`Concurrency: ${config.concurrency} parallel requests`);
  console.log("");

  try {
    await processEmbeddings(config, flags.verbose);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  } finally {
    await db.close();
  }
}
