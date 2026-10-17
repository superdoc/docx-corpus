import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createR2Client, type R2Config } from "@docx-corpus/shared";

export interface CdxRecord {
  url: string;
  mime: string;
  status: string;
  digest: string;
  length: string;
  offset: string;
  filename: string;
}

export async function* streamCdxFromR2(r2: R2Config, crawlId: string): AsyncGenerator<CdxRecord> {
  const client = createR2Client(r2);

  let continuationToken: string | undefined;
  do {
    const { Contents = [], NextContinuationToken } = await client.send(
      new ListObjectsV2Command({
        Bucket: r2.bucket,
        Prefix: `cdx-filtered/${crawlId}/`,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of Contents) {
      if (!obj.Key?.endsWith(".jsonl")) continue;

      const response = await client.send(
        new GetObjectCommand({
          Bucket: r2.bucket,
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
