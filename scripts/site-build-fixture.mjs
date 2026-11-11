// CI-only Neon HTTP adapter. Execute the site's unchanged SQL against a local
// PostgreSQL engine with public synthetic rows. Never contact a real database.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

export const fixtureUrl = 'postgresql://synthetic:synthetic@privacy-fixture.invalid/corpus';
if (process.env.DATABASE_URL !== fixtureUrl) {
  throw new Error('The site fixture requires its synthetic database URL');
}
const db = new PGlite();
await db.exec(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
await db.exec(`INSERT INTO documents
 (id, source_url, crawl_id, original_filename, document_type, document_topic, language, classification_confidence, status)
 VALUES
 ('synthetic-001','https://example.invalid/contract.docx','synthetic','Synthetic contract.docx','legal','legal_judicial','en',0.95,'uploaded'),
 ('synthetic-002','https://example.invalid/spec.docx','synthetic','Synthetic specification.docx','technical','technology','en',0.85,'uploaded'),
 ('synthetic-003','https://example.invalid/policy.docx','synthetic','Synthetic policy.docx','policies','government','fr',0.75,'uploaded');`);

const nativeFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (!headers.has('Neon-Connection-String')) return nativeFetch(input, init);
  if (headers.get('Neon-Connection-String') !== fixtureUrl) {
    throw new Error('Site fixture refuses a non-synthetic database');
  }
  const body = JSON.parse(init.body);
  const execute = async (query) => {
    const result = await db.query(query.query, query.params);
    return {
      fields: result.fields,
      rows: result.rows.map(row => result.fields.map(field => row[field.name] === null ? null : String(row[field.name]))),
      rowCount: result.rows.length,
      command: 'SELECT',
    };
  };
  const result = body.queries
    ? { results: await Promise.all(body.queries.map(execute)) }
    : await execute(body);
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
};
