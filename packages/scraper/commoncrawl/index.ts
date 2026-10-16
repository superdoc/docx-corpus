const COLLINFO_URL = "https://index.commoncrawl.org/collinfo.json";

/**
 * Fetch all crawl IDs from Common Crawl's index API, newest first.
 */
export async function getAllCrawlIds(): Promise<string[]> {
  const res = await fetch(COLLINFO_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch crawl list: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { id: string }[];
  return data.map((c) => c.id);
}

export async function getLatestCrawlId(): Promise<string> {
  const ids = await getAllCrawlIds();
  if (ids.length === 0) {
    throw new Error("No crawls available");
  }
  return ids[0];
}

export async function getCrawlIds(count: number): Promise<string[]> {
  if (!Number.isFinite(count) || count < 1) {
    throw new Error(`Invalid crawl count: ${count}`);
  }
  return (await getAllCrawlIds()).slice(0, count);
}
