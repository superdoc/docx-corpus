import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Storage } from "./types";

/**
 * Create a local filesystem storage adapter.
 * Keys are relative paths within basePath (e.g., "documents/abc123.docx").
 */
export function createLocalStorage(basePath: string): Storage {
  return {
    async read(key: string): Promise<Uint8Array | null> {
      const file = Bun.file(join(basePath, key));
      if (!(await file.exists())) return null;
      return new Uint8Array(await file.arrayBuffer());
    },

    async exists(key: string): Promise<boolean> {
      return Bun.file(join(basePath, key)).exists();
    },

    async write(key: string, content: Uint8Array | string): Promise<void> {
      const filePath = join(basePath, key);
      // Ensure parent directory exists
      await mkdir(dirname(filePath), { recursive: true });
      await Bun.write(filePath, content);
    },

    async writeIfNotExists(key: string, content: Uint8Array): Promise<boolean> {
      const file = Bun.file(join(basePath, key));
      if (await file.exists()) return false;
      const filePath = join(basePath, key);
      await mkdir(dirname(filePath), { recursive: true });
      await Bun.write(filePath, content);
      return true;
    },
  };
}
