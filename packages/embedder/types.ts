import type { DbClient, Storage } from "@docx-corpus/shared";

/**
 * Configuration for the embedding process
 */
export interface EmbedConfig {
  db: DbClient;
  storage: Storage;
  inputPrefix: string;
  batchSize: number;
  concurrency: number;
}
