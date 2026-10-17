import { blank, createDb, header, keyValue, loadDatabaseUrl, section } from "@docx-corpus/shared";
import { version } from "../package.json";

export async function runStatus(_args: string[]) {
  header("docx-corpus", version);

  const db = await createDb(loadDatabaseUrl());

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
  } finally {
    await db.close();
  }
}
