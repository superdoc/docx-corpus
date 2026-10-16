import type { DbClient, Storage } from "@docx-corpus/shared";

/**
 * Configuration for the extraction process
 */
export interface ExtractConfig {
  db: DbClient;
  storage: Storage;
  inputPrefix: string;
  outputPrefix: string;
  batchSize: number;
  workers: number;
}
