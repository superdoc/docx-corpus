import { type ExtractConfig, processDirectory } from "@docx-corpus/extractor";
import { createDb, loadDatabaseUrl, loadStorage } from "@docx-corpus/shared";
import { parseFlags, positiveInt } from "../flags";

const HELP = `
corpus extract - Extract text from DOCX files using Docling

Usage
  corpus extract [options]

Storage is auto-selected based on environment:
  - With R2 credentials: reads from r2://documents/, writes to r2://extracted/
  - Without R2 credentials: reads from ./corpus/documents/, writes to ./corpus/extracted/

Extraction progress is tracked in the database (extracted_at column).

Options
  --batch, -b <n>         Limit to n documents (default: all)
  --workers, -w <n>       Number of parallel workers (default: from EXTRACT_WORKERS or 4)
  --verbose, -v           Show detailed progress
  --help, -h              Show this help

Environment Variables
  DATABASE_URL            PostgreSQL connection string (required)
  STORAGE_PATH            Local storage path (default: ./corpus)
  CLOUDFLARE_ACCOUNT_ID   Cloudflare account ID (enables R2)
  R2_ACCESS_KEY_ID        R2 access key
  R2_SECRET_ACCESS_KEY    R2 secret key
  R2_BUCKET_NAME          R2 bucket (default: docx-corpus)
  EXTRACT_INPUT_PREFIX    Input prefix (default: documents)
  EXTRACT_OUTPUT_PREFIX   Output prefix (default: extracted)
  EXTRACT_WORKERS         Worker count (default: 4)

Examples
  corpus extract                    # Extract all documents
  corpus extract -b 100             # Limit to 100 documents
  corpus extract -v                 # With verbose output
  corpus extract -b 50 -w 8         # Custom batch/workers
`;

export async function runExtract(args: string[]) {
  const flags = parseFlags(args, HELP, {
    batch: { type: "string", short: "b" },
    workers: { type: "string", short: "w" },
    verbose: { type: "boolean", short: "v", default: false },
  });
  const { storage, location } = loadStorage();
  const db = await createDb(loadDatabaseUrl());

  const config: ExtractConfig = {
    db,
    storage,
    inputPrefix: process.env.EXTRACT_INPUT_PREFIX || "documents",
    outputPrefix: process.env.EXTRACT_OUTPUT_PREFIX || "extracted",
    limit: positiveInt(flags.batch, "--batch"),
    workers:
      positiveInt(flags.workers, "--workers") ??
      positiveInt(process.env.EXTRACT_WORKERS, "EXTRACT_WORKERS") ??
      4,
  };

  console.log("Text Extractor");
  console.log("==============");
  console.log(`Storage: ${location}`);
  console.log(`Input:   ${config.inputPrefix}/`);
  console.log(`Output:  ${config.outputPrefix}/`);
  console.log(`Workers: ${config.workers}`);
  console.log(`Batch:   ${config.limit ?? "all"}`);
  console.log("");

  try {
    await processDirectory(config, flags.verbose);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  } finally {
    await db.close();
  }
}
