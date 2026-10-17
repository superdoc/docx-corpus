import { describe, expect, test } from "bun:test";
import { parseCrawlSpec } from "./commands/scrape";
import { parseFlags, positiveInt } from "./flags";

describe("parseCrawlSpec", () => {
  test("a bare number is a count of the latest crawls", () => {
    expect(parseCrawlSpec("3")).toEqual({ count: 3 });
    expect(parseCrawlSpec("0")).toEqual({ count: 0 });
  });

  test("anything else is a single ID or a comma-separated list", () => {
    expect(parseCrawlSpec("CC-MAIN-2025-51")).toEqual({ ids: ["CC-MAIN-2025-51"] });
    expect(parseCrawlSpec("CC-MAIN-2025-51 , CC-MAIN-2025-48,")).toEqual({
      ids: ["CC-MAIN-2025-51", "CC-MAIN-2025-48"],
    });
  });

  test("a list of only commas has no IDs", () => {
    expect(parseCrawlSpec(",,,")).toEqual({ ids: [] });
  });
});

describe("parseFlags", () => {
  const options = {
    crawl: { type: "string" },
    force: { type: "boolean", short: "f" },
  } as const;

  test("reads long and short flags, and the last repeated value wins", () => {
    expect(parseFlags(["--crawl", "3", "-f", "--crawl", "X"], "", options)).toEqual({
      crawl: "X",
      force: true,
    });
  });

  test("rejects unknown flags and missing values", () => {
    expect(() => parseFlags(["--crawll", "3"], "", options)).toThrow("Unknown option '--crawll'");
    expect(() => parseFlags(["--crawl"], "", options)).toThrow("argument missing");
  });
});

describe("positiveInt", () => {
  test("parses positive integers and passes through an absent flag", () => {
    expect(positiveInt("50", "batch")).toBe(50);
    expect(positiveInt(undefined, "batch")).toBeUndefined();
  });

  test("rejects zero, negatives, and non-numbers", () => {
    for (const value of ["0", "-1", "abc", "1.5", ""]) {
      expect(() => positiveInt(value, "batch")).toThrow("--batch must be a positive integer");
    }
  });
});
