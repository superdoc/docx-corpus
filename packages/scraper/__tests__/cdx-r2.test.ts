import { describe, expect, test } from "bun:test";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { streamCdxFromR2 } from "../commoncrawl/cdx-r2";
import type { Config } from "../config";

const config = {
  cloudflare: {
    accountId: "test",
    r2AccessKeyId: "test",
    r2SecretAccessKey: "test",
    r2BucketName: "bucket",
  },
} as Config;

describe("streamCdxFromR2", () => {
  test("follows R2 list continuation tokens", async () => {
    const pages: Record<string, { Contents: { Key: string }[]; NextContinuationToken?: string }> = {
      first: { Contents: [{ Key: "cdx-filtered/C/a.jsonl" }], NextContinuationToken: "next" },
      next: { Contents: [{ Key: "cdx-filtered/C/b.jsonl" }] },
    };
    const original = S3Client.prototype.send;
    S3Client.prototype.send = (async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        return pages[command.input.ContinuationToken ?? "first"];
      }
      if (command instanceof GetObjectCommand) {
        const url = `https://example.com/${command.input.Key}.docx`;
        return { Body: { transformToString: async () => `${JSON.stringify({ url })}\n` } };
      }
      throw new Error("unexpected command");
    }) as typeof original;

    try {
      const urls: string[] = [];
      for await (const record of streamCdxFromR2(config, "C")) urls.push(record.url);
      expect(urls).toEqual([
        "https://example.com/cdx-filtered/C/a.jsonl.docx",
        "https://example.com/cdx-filtered/C/b.jsonl.docx",
      ]);
    } finally {
      S3Client.prototype.send = original;
    }
  });
});
