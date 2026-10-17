import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { R2Config, Storage } from "./types";

export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Create a Cloudflare R2 storage adapter.
 * Keys are S3 object keys (e.g., "documents/abc123.docx").
 */
export function createR2Storage(config: R2Config): Storage {
  const client = createR2Client(config);

  const bucket = config.bucket;

  async function exists(key: string): Promise<boolean> {
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  const storage: Storage = {
    async read(key: string): Promise<Uint8Array | null> {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!response.Body) return null;
        return new Uint8Array(await response.Body.transformToByteArray());
      } catch (err: any) {
        if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw err;
      }
    },

    async write(key: string, content: Uint8Array | string): Promise<void> {
      // Always convert to Uint8Array and set ContentLength to avoid
      // "Stream of unknown length" errors with S3-compatible storage
      const body = typeof content === "string" ? new TextEncoder().encode(content) : content;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: body.length,
        }),
      );
    },

    async writeIfNotExists(key: string, content: Uint8Array): Promise<boolean> {
      if (await exists(key)) return false;
      await storage.write(key, content);
      return true;
    },
  };

  return storage;
}
