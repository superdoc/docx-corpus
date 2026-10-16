import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import type { Config } from "../config";

export interface CdxRecord {
  url: string;
  mime: string;
  status: string;
  digest: string;
  length: string;
  offset: string;
  filename: string;
}

export async function* streamCdxFromR2(config: Config, crawlId: string): AsyncGenerator<CdxRecord> {
  const { cloudflare } = config;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cloudflare.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cloudflare.r2AccessKeyId,
      secretAccessKey: cloudflare.r2SecretAccessKey,
    },
  });

  let continuationToken: string | undefined;
  do {
    const { Contents = [], NextContinuationToken } = await client.send(
      new ListObjectsV2Command({
        Bucket: cloudflare.r2BucketName,
        Prefix: `cdx-filtered/${crawlId}/`,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of Contents) {
      if (!obj.Key?.endsWith(".jsonl")) continue;

      const response = await client.send(
        new GetObjectCommand({
          Bucket: cloudflare.r2BucketName,
          Key: obj.Key,
        }),
      );

      const text = await response.Body?.transformToString();
      if (!text) continue;

      for (const line of text.split("\n")) {
        if (line.trim()) {
          yield JSON.parse(line) as CdxRecord;
        }
      }
    }

    continuationToken = NextContinuationToken;
  } while (continuationToken);
}
