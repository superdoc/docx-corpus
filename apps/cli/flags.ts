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
    throw new ConfigError(err instanceof Error ? err.message : String(err));
  }
}

/** A positive integer flag value, or undefined when the flag is absent. */
export function positiveInt(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new ConfigError(`--${flag} must be a positive integer, got "${value}"`);
  }
  return n;
}
