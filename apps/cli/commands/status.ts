import { loadConfig } from "@docx-corpus/scraper";
import { blank, createDb, header, keyValue, section } from "@docx-corpus/shared";
import { version } from "../package.json";

export async function runStatus(_args: string[]) {
  header("docx-corpus", version);

  const config = loadConfig();
  const db = await createDb(config.database.url);

  try {
    // Scraping stats
    const scrapingStats = await db.getStats();
    section("Scraping");
    let total = 0;
    for (const { status, count } of scrapingStats) {
      keyValue(status, count);
      total += count;
    }
    keyValue("total", total);

    // Extraction stats
    const extractionStats = await db.getExtractionStats();
    blank();
    section("Extraction");
    keyValue("extracted", extractionStats.extracted);
    keyValue("pending", extractionStats.pending);
    keyValue("errors", extractionStats.errors);

    // Embedding stats
    const embeddingStats = await db.getEmbeddingStats();
    blank();
    section("Embedding");
    keyValue("embedded", embeddingStats.embedded);
    keyValue("pending", embeddingStats.pending);

    // LLM Classification stats
    const llmStats = await db.getLLMClassificationStats();
    blank();
    section("Classification (ML)");
    keyValue("classified", llmStats.classified);
    keyValue("pending", llmStats.pending);
    if (Object.keys(llmStats.byType).length > 0) {
      blank();
      section("By type");
      for (const [type, count] of Object.entries(llmStats.byType)) {
        keyValue(type, count);
      }
    }

    // Clustering stats
    const clusterStats = await db.getClassificationStats();
    if (clusterStats.classified > 0) {
      blank();
      section("Clustering");
      keyValue("clustered", clusterStats.classified);
      keyValue("pending", clusterStats.pending);
      keyValue("clusters", clusterStats.clusters);
    }
  } finally {
    await db.close();
  }
}
