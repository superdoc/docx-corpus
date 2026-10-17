import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createR2Client, type R2Config } from "@docx-corpus/shared";

export interface FilteredCrawl {
  id: string;
  files: number;
  totalSize: number;
}

/**
 * List all CDX-filtered crawls available in R2.
 * Returns crawls sorted newest-first.
 */
export async function listFilteredCrawls(r2: R2Config): Promise<FilteredCrawl[]> {
  const client = createR2Client(r2);

  const crawls = new Map<string, FilteredCrawl>();
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: r2.bucket,
        Prefix: "cdx-filtered/",
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of response.Contents || []) {
      if (!obj.Key) continue;
      // Key format: cdx-filtered/CC-MAIN-2025-51/part-00001.jsonl
      const parts = obj.Key.split("/");
      if (parts.length < 3) continue;

      const crawlId = parts[1];
      if (!crawls.has(crawlId)) {
        crawls.set(crawlId, { id: crawlId, files: 0, totalSize: 0 });
      }
      const info = crawls.get(crawlId)!;
      info.files++;
      info.totalSize += obj.Size || 0;
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return [...crawls.values()].sort((a, b) => b.id.localeCompare(a.id));
}
