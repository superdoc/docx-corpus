import { join } from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client, type R2Config } from "@docx-corpus/shared";
import { SQL } from "bun";

export async function generateManifest(
  databaseUrl: string,
  localPath: string,
  r2: R2Config,
): Promise<{ count: number; path: string } | null> {
  const sql = new SQL({ url: databaseUrl });

  const rows = await sql<{ id: string }[]>`
    SELECT id FROM documents WHERE status = 'uploaded' ORDER BY id
  `;

  await sql.close();

  if (rows.length === 0) {
    return null;
  }

  const path = join(localPath, "manifest.txt");
  const content = `${rows.map((r) => r.id).join("\n")}\n`;
  await Bun.write(path, content);

  await createR2Client(r2).send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: "manifest.txt",
      Body: content,
      ContentType: "text/plain",
    }),
  );

  return { count: rows.length, path };
}
