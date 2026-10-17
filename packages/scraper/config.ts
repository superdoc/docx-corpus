import { loadDatabaseUrl, loadR2Config, type R2Config } from "@docx-corpus/shared";

export interface Config {
  crawl: {
    id: string;
    concurrency: number;
    rateLimitRps: number;
    maxRps: number;
    minRps: number;
    timeoutMs: number;
  };
  storage: {
    localPath: string;
  };
  database: {
    url: string;
  };
  r2: R2Config | null;
}

export function loadConfig(): Config {
  const env = process.env;

  return {
    crawl: {
      id: env.CRAWL_ID || "",
      concurrency: parseInt(env.CONCURRENCY || "", 10) || 1,
      rateLimitRps: parseInt(env.RATE_LIMIT_RPS || "", 10) || 2,
      maxRps: parseInt(env.MAX_RPS || "", 10) || 5,
      minRps: parseInt(env.MIN_RPS || "", 10) || 1,
      timeoutMs: parseInt(env.TIMEOUT_MS || "", 10) || 45000,
    },
    storage: {
      localPath: env.STORAGE_PATH || "./corpus",
    },
    database: {
      url: loadDatabaseUrl(),
    },
    r2: loadR2Config(),
  };
}
