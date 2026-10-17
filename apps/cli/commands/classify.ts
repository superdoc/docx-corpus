import { resolve } from "node:path";
import { blank, createDb, header, keyValue, loadDatabaseUrl, section } from "@docx-corpus/shared";
import { parseFlags } from "../flags";

const HELP = `
corpus classify - Classify documents by type and topic

Usage
  corpus classify [options]

Runs the trained XLM-RoBERTa classifiers on all unclassified documents.
Wraps scripts/classification/classify.py — requires Python 3.11+ with
classification dependencies installed.

Options
  --models-dir, -m <dir>   Path to trained models (default: ./models)
  --batch-size, -b <n>     Inference batch size (default: 128)
  --languages, -l <codes>  Comma-separated language filter (e.g. en,ru)
  --modal                  Run on Modal cloud GPUs
  --workers, -w <n>        Modal parallel workers (default: 20)
  --gpu <type>             Modal GPU type (default: a10g)
  --help, -h               Show this help

Setup
  cd scripts/classification
  pip install -e .    # or: uv pip install -e .

Examples
  corpus classify                              # Classify all pending
  corpus classify -m ~/data/models -b 256      # Custom models dir + batch
  corpus classify -l en,ru                     # Only English and Russian
  corpus classify --modal --workers 20         # Cloud GPU classification
`;

export async function runClassify(args: string[]) {
  const flags = parseFlags(args, HELP, {
    "models-dir": { type: "string", short: "m", default: "./models" },
    "batch-size": { type: "string", short: "b", default: "128" },
    languages: { type: "string", short: "l" },
    modal: { type: "boolean", default: false },
    workers: { type: "string", short: "w", default: "20" },
    gpu: { type: "string", default: "a10g" },
  });
  const db = await createDb(loadDatabaseUrl());

  try {
    // Show current classification state
    const stats = await db.getLLMClassificationStats();
    header("docx-corpus", "classify");
    section("Current state");
    keyValue("classified", stats.classified);
    keyValue("pending", stats.pending);
    blank();

    if (stats.pending === 0) {
      console.log("All documents are already classified.");
      return;
    }

    // Build Python command
    const scriptDir = resolve(import.meta.dir, "../../../scripts/classification");
    const scriptPath = resolve(scriptDir, "classify.py");

    const pythonArgs = [
      "python",
      scriptPath,
      "--models-dir",
      flags["models-dir"],
      "--batch-size",
      flags["batch-size"],
    ];

    if (flags.languages) {
      pythonArgs.push("--languages", flags.languages);
    }

    if (flags.modal) {
      pythonArgs.push("--modal");
      pythonArgs.push("--workers", flags.workers);
      pythonArgs.push("--gpu", flags.gpu);
    }

    section("Running classifier");
    console.log(`Script:    ${scriptPath}`);
    console.log(`Models:    ${flags["models-dir"]}`);
    console.log(`Batch:     ${flags["batch-size"]}`);
    console.log(
      `Modal:     ${flags.modal ? `yes (${flags.workers} workers, ${flags.gpu})` : "no (local)"}`,
    );
    if (flags.languages) console.log(`Languages: ${flags.languages}`);
    blank();

    // Run Python classifier as subprocess
    const proc = Bun.spawn(pythonArgs, {
      cwd: scriptDir,
      stdio: ["inherit", "inherit", "inherit"],
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.error(`\nClassification failed with exit code ${exitCode}`);
      process.exit(1);
    }

    // Show updated stats
    blank();
    const updated = await db.getLLMClassificationStats();
    section("Updated state");
    keyValue("classified", updated.classified);
    keyValue("pending", updated.pending);
  } finally {
    await db.close();
  }
}
