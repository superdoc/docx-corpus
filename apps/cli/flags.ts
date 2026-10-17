import { type ParseArgsOptionsConfig, parseArgs } from "node:util";
import { ConfigError } from "@docx-corpus/shared";

/** Parses a command's flags, rejecting unknown ones; prints the help and exits on --help or -h. */
export function parseFlags<T extends ParseArgsOptionsConfig>(
  args: string[],
  help: string,
  options: T,
) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(help);
    process.exit(0);
  }
  try {
    return parseArgs({ args, options }).values;
  } catch (err) {
    // parseArgs hints span several lines; keep the error to one.
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigError(message.replace(/\s*\n\s*/g, " "));
  }
}

/** A positive integer from a flag or environment variable, or undefined when it is unset. */
export function positiveInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new ConfigError(`${name} must be a positive integer, got "${value}"`);
  }
  return n;
}
