import { getCrawlIds, loadConfig, scrape } from "@docx-corpus/scraper";
import { parseFlags } from "../flags";
import { version } from "../package.json";

export type CrawlSpec = { count: number } | { ids: string[] };

/** `--crawl 3` is the latest 3 crawls; otherwise one ID or a comma-separated list. */
export function parseCrawlSpec(value: string): CrawlSpec {
  if (/^\d+$/.test(value)) return { count: parseInt(value, 10) };
  return {
    ids: value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  };
}

const HELP = `
corpus scrape - Download .docx files from Common Crawl

Usage
  corpus scrape [options]

Options
  --crawl <spec>  Crawl(s) to process (default: latest)
                    <n>         Latest n crawls (e.g., --crawl 3)
                    <id>        Single crawl ID
                    <id>,<id>   Comma-separated list
  --force, -f       Re-process all URLs from scratch
  --retry-failed    Re-download only previously failed URLs
  --verbose, -v     Show detailed logs for debugging
  --help, -h        Show this help

Environment Variables
  CRAWL_ID             Common Crawl index ID (e.g., CC-MAIN-2025-51)
  CONCURRENCY          Parallel WARC file downloads (default: 1)
  RATE_LIMIT_RPS       WARC requests per second (default: 2)

Examples
  corpus scrape --crawl CC-MAIN-2025-51
  corpus scrape --crawl CC-MAIN-2025-51,CC-MAIN-2025-48
`;

export async function runScrape(args: string[]) {
  const flags = parseFlags(args, HELP, {
    crawl: { type: "string" },
    verbose: { type: "boolean", short: "v" },
    force: { type: "boolean", short: "f" },
    "retry-failed": { type: "boolean" },
  });
  const config = loadConfig();
  const spec = flags.crawl === undefined ? undefined : parseCrawlSpec(flags.crawl);

  // Resolve crawl IDs from flags
  let crawlIds: string[] | undefined;
  if (spec && "count" in spec) {
    if (spec.count < 1) {
      console.error("Error: --crawl count must be at least 1");
      process.exit(1);
    }
    crawlIds = await getCrawlIds(spec.count);
    if (crawlIds.length === 0) {
      console.error("Error: No crawls available");
      process.exit(1);
    }
    if (crawlIds.length < spec.count) {
      console.warn(`Warning: Only ${crawlIds.length} crawls available (requested ${spec.count})`);
    }
  } else if (spec) {
    if (spec.ids.length === 0) {
      console.error("Error: --crawl requires at least one valid crawl ID");
      process.exit(1);
    }
    crawlIds = spec.ids;
  }

  await scrape({
    config,
    verbose: flags.verbose,
    force: flags.force,
    retryFailed: flags["retry-failed"],
    crawlIds,
    version,
  });

  process.exit(0);
}
