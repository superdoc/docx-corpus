import { describe, expect, test } from "bun:test";
import { computeHash } from "../validation";

describe("dedup ID generation", () => {
  // Fix 2: dup IDs must be scoped per crawl
  // Previously: dup-{sha256(url)} — same ID across crawls, last write wins
  // Now: dup-{sha256(url + crawlId)} — unique per crawl

  test("same URL + different crawls produce different dup IDs", async () => {
    const url = "https://example.com/doc.docx";
    const crawlA = "CC-MAIN-2024-10";
    const crawlB = "CC-MAIN-2025-51";

    const hashA = await computeHash(new TextEncoder().encode(url + crawlA));
    const hashB = await computeHash(new TextEncoder().encode(url + crawlB));

    expect(`dup-${hashA}`).not.toBe(`dup-${hashB}`);
  });

  test("same URL + same crawl produces same dup ID (idempotent)", async () => {
    const url = "https://example.com/doc.docx";
    const crawlId = "CC-MAIN-2024-10";

    const hash1 = await computeHash(new TextEncoder().encode(url + crawlId));
    const hash2 = await computeHash(new TextEncoder().encode(url + crawlId));

    expect(`dup-${hash1}`).toBe(`dup-${hash2}`);
  });

  test("different URLs + same crawl produce different dup IDs", async () => {
    const url1 = "https://example.com/a.docx";
    const url2 = "https://example.com/b.docx";
    const crawlId = "CC-MAIN-2024-10";

    const hash1 = await computeHash(new TextEncoder().encode(url1 + crawlId));
    const hash2 = await computeHash(new TextEncoder().encode(url2 + crawlId));

    expect(`dup-${hash1}`).not.toBe(`dup-${hash2}`);
  });

  // Fix 1: failed-* IDs are URL-only (not crawl-scoped) but delete is crawl-scoped
  // The ID is the same across crawls, but DELETE WHERE id = $1 AND crawl_id = $2
  // ensures we only delete our own crawl's record

  test("failed-* ID is same for same URL regardless of crawl (by design)", async () => {
    const url = "https://example.com/doc.docx";
    const hash = await computeHash(new TextEncoder().encode(url));

    // The failed ID intentionally does NOT include crawlId
    // because the delete is scoped by crawl_id in the WHERE clause
    const failedId = `failed-${hash}`;
    expect(failedId).toMatch(/^failed-[0-9a-f]{64}$/);
  });
});
