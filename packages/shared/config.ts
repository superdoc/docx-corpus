import { createLocalStorage } from "./storage/local";
import { createR2Storage } from "./storage/r2";
import type { R2Config, Storage } from "./storage/types";

/** A missing or invalid setting; the CLI prints its message without a stack trace. */
export class ConfigError extends Error {}

export function loadDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new ConfigError("DATABASE_URL is not set (see .env.example)");
  return url;
}

/** R2 credentials from the environment, or null unless all three are set. */
export function loadR2Config(): R2Config | null {
  const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } =
    process.env;
  if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return {
    accountId: CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET_NAME || "docx-corpus",
  };
}

/** R2 when its credentials are set, otherwise files under STORAGE_PATH. */
export function loadStorage(): { storage: Storage; location: string } {
  const r2 = loadR2Config();
  if (r2) return { storage: createR2Storage(r2), location: `R2 (${r2.bucket})` };
  const localPath = process.env.STORAGE_PATH || "./corpus";
  return { storage: createLocalStorage(localPath), location: `local (${localPath})` };
}
