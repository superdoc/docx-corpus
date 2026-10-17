import { resolve } from "node:path";
import { parseFlags } from "../flags";

const HELP = `
corpus export - Export corpus metadata to HuggingFace

Usage
  corpus export [options]

Exports classified document metadata to a Parquet file and optionally
pushes to HuggingFace. Wraps scripts/export-hf.py — requires Python 3.11+
with uv (dependencies are inline in the script).

Options
  --push                Push to HuggingFace (default: local export only)
  --private             Create as private dataset
  --output, -o <path>   Local parquet output path (default: docx-corpus.parquet)
  --help, -h            Show this help

Setup
  uv is recommended (dependencies are declared inline in the script).
  huggingface-cli login   # Required for --push

Examples
  corpus export                    # Dry run: export parquet locally
  corpus export --push             # Export and push to HuggingFace
  corpus export --push --private   # Push as private dataset
`;

export async function runExport(args: string[]) {
  const flags = parseFlags(args, HELP, {
    push: { type: "boolean", default: false },
    private: { type: "boolean", default: false },
    output: { type: "string", short: "o", default: "docx-corpus.parquet" },
  });
  const scriptPath = resolve(import.meta.dir, "../../../scripts/export-hf.py");

  const uvArgs = ["uv", "run", scriptPath];

  if (flags.push) uvArgs.push("--push");
  if (flags.private) uvArgs.push("--private");
  uvArgs.push("--output", flags.output);

  console.log("HuggingFace Export");
  console.log("==================");
  console.log(`Script: ${scriptPath}`);
  console.log(`Output: ${flags.output}`);
  console.log(`Push:   ${flags.push ? "yes" : "no (dry run)"}`);
  console.log("");

  const proc = Bun.spawn(uvArgs, {
    cwd: resolve(import.meta.dir, "../../.."),
    stdio: ["inherit", "inherit", "inherit"],
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error(`\nExport failed with exit code ${exitCode}`);
    process.exit(1);
  }
}
