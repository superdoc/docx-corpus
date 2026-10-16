import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { createDb, type DbClient, type Storage } from "@docx-corpus/shared";
import { SQL } from "bun";
import type { CdxRecord } from "../commoncrawl/cdx-r2";
import type { WarcResult } from "../commoncrawl/warc";
import type { Config } from "../config";
import { createRateLimiter } from "../rate-limiter";
import { type ProcessContext, processRecord } from "../scraper";

// The guarantees under test live in Postgres (transactions, advisory locks), so these tests need
// a database with db/schema.sql applied. They delete every row in `documents`, so never point
// TEST_DATABASE_URL at real data. They skip when it is unset.
const url = process.env.TEST_DATABASE_URL;

const storage: Storage = {
  read: async () => null,
  exists: async () => false,
  write: async () => {},
  writeIfNotExists: async () => true,
};

const INVALID = new TextEncoder().encode("not a docx file ".repeat(10));
const DOCX = new Uint8Array([
  0x50,
  0x4b,
  0x03,
  0x04,
  ...new TextEncoder().encode("[Content_Types].xml word/document.xml ".repeat(4)),
]);
const URL_A = "https://a.example/x.docx";
const URL_B = "https://b.example/x.docx";

const returns = (content: Uint8Array) => async (): Promise<WarcResult> => ({
  content,
  httpStatus: 200,
  contentType: "",
  contentLength: content.length,
});
const fails = async (): Promise<WarcResult> => {
  throw new Error("WARC fetch failed: 404");
};

describe.skipIf(!url)("processRecord failed records", () => {
  let db: DbClient;
  let sql: SQL;

  beforeEach(async () => {
    db ??= await createDb(url as string);
    sql ??= new SQL({ url: url as string });
    await sql`DELETE FROM documents`;
  });

  afterAll(async () => {
    await db?.close();
    await sql?.close();
  });

  function run(source: string, crawlId: string, fetch: ProcessContext["fetch"]) {
    const record: CdxRecord = {
      url: source,
      mime: "",
      status: "200",
      digest: "",
      length: "1",
      offset: "0",
      filename: "f",
    };
    return processRecord(record, {
      db,
      storage,
      config: { crawl: { timeoutMs: 1000 } } as Config,
      crawlId,
      stats: { saved: 0, skipped: 0, failed: 0 },
      rateLimiter: createRateLimiter(1000),
      processedHashes: new Set(),
      fetch,
    });
  }

  async function rows() {
    const result = await sql<{ crawl_id: string; status: string; source_url: string }[]>`
      SELECT crawl_id, status, source_url FROM documents
    `;
    return result.map((r) => `${r.crawl_id} ${r.status} ${r.source_url}`).sort();
  }

  test("two URLs with the same invalid content keep one record each", async () => {
    await run(URL_A, "C1", returns(INVALID));
    await run(URL_B, "C1", returns(INVALID));
    expect(await rows()).toEqual([`C1 failed ${URL_A}`, `C1 failed ${URL_B}`]);
  });

  test("a URL that fails in two crawls keeps one record per crawl", async () => {
    await run(URL_A, "C1", fails);
    await run(URL_A, "C2", fails);
    expect(await rows()).toEqual([`C1 failed ${URL_A}`, `C2 failed ${URL_A}`]);
  });

  test("a successful retry replaces the failure in its own crawl only", async () => {
    await run(URL_A, "C1", fails);
    await run(URL_A, "C2", fails);
    await run(URL_A, "C2", returns(DOCX));
    expect(await rows()).toEqual([`C1 failed ${URL_A}`, `C2 uploaded ${URL_A}`]);
  });

  test("a download failure followed by invalid content leaves one failed record", async () => {
    await run(URL_A, "C1", fails);
    await run(URL_A, "C1", returns(INVALID));
    expect(await rows()).toEqual([`C1 failed ${URL_A}`]);
  });

  test("a retry replaces failed rows written with older ID formats", async () => {
    await sql`
      INSERT INTO documents (id, source_url, crawl_id, status) VALUES
        ('failed-legacy-url-hash', ${URL_A}, 'C1', 'failed'),
        ('legacy-content-hash', ${URL_A}, 'C1', 'failed')
    `;
    await run(URL_A, "C1", fails);
    expect(await rows()).toEqual([`C1 failed ${URL_A}`]);
  });

  test("an earlier failure stays until the retry has an outcome", async () => {
    await run(URL_A, "C1", fails);
    let release = () => {};
    const pending = run(URL_A, "C1", async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return returns(DOCX)();
    });
    await Bun.sleep(20);
    expect(await rows()).toEqual([`C1 failed ${URL_A}`]);
    release();
    await pending;
    expect(await rows()).toEqual([`C1 uploaded ${URL_A}`]);
  });

  test("a failing capture that finishes first does not survive beside a success", async () => {
    let release = () => {};
    const slowSuccess = run(URL_A, "C1", async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return returns(DOCX)();
    });
    await run(URL_A, "C1", fails);
    release();
    await slowSuccess;
    expect(await rows()).toEqual([`C1 uploaded ${URL_A}`]);
  });

  test("a failing capture that finishes last does not replace a success", async () => {
    await run(URL_A, "C1", returns(DOCX));
    await run(URL_A, "C1", fails);
    expect(await rows()).toEqual([`C1 uploaded ${URL_A}`]);
  });

  test("a later failure clears stale failed rows beside an existing success", async () => {
    await sql`
      INSERT INTO documents (id, source_url, crawl_id, status) VALUES
        ('legacy-success', ${URL_A}, 'C1', 'uploaded'),
        ('failed-legacy-url-hash', ${URL_A}, 'C1', 'failed')
    `;
    await run(URL_A, "C1", fails);
    expect(await rows()).toEqual([`C1 uploaded ${URL_A}`]);
  });

  test("after migration 007, a failed row from older scrapes neither blocks nor loses to an upload", async () => {
    // Older scrapes stored failed rows under the content hash, the ID an upload of those bytes uses.
    const hash = new Bun.CryptoHasher("sha256").update(DOCX).digest("hex");
    await sql`
      INSERT INTO documents (id, source_url, crawl_id, status, is_valid_docx)
      VALUES (${hash}, ${URL_B}, 'C0', 'failed', true)
    `;
    await sql.file(
      `${import.meta.dir}/../../../db/migrations/007_rekey_content_hash_failed_rows.sql`,
    );
    await run(URL_A, "C1", returns(DOCX));
    expect(await rows()).toEqual([`C0 failed ${URL_B}`, `C1 uploaded ${URL_A}`]);
  });

  test("valid content is not a duplicate of a failed row with the same content hash", async () => {
    // Before migration 007 the failed row's ID is the content hash, which content dedup looked up.
    const hash = new Bun.CryptoHasher("sha256").update(DOCX).digest("hex");
    await sql`
      INSERT INTO documents (id, source_url, crawl_id, status, is_valid_docx)
      VALUES (${hash}, ${URL_B}, 'C0', 'failed', true)
    `;
    await run(URL_A, "C1", returns(DOCX));
    expect(await rows()).toContain(`C1 uploaded ${URL_A}`);
  });

  test("concurrent failures and one success leave only the success", async () => {
    await Promise.all([
      run(URL_A, "C1", fails),
      run(URL_A, "C1", returns(DOCX)),
      run(URL_A, "C1", returns(INVALID)),
      run(URL_A, "C1", fails),
    ]);
    expect(await rows()).toEqual([`C1 uploaded ${URL_A}`]);
  });
});
