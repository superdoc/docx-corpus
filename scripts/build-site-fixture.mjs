import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const app = new URL('../apps/site/', import.meta.url);
const astro = JSON.parse(await readFile(new URL('node_modules/astro/package.json', app), 'utf8'));
const binary = typeof astro.bin === 'string' ? astro.bin : astro.bin.astro;
execFileSync(process.execPath, [fileURLToPath(new URL('node_modules/astro/' + binary, app)), 'build'], {
  cwd: fileURLToPath(app),
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://synthetic:synthetic@privacy-fixture.invalid/corpus',
    NODE_OPTIONS: `--import=${new URL('./site-build-fixture.mjs', import.meta.url).href}`,
  },
});
// Prove a useful build: synthetic SQL facets and documents reached actual HTML,
// while privacy content and discovery surfaces are present in the output.
assert.match(await readFile(new URL('dist/types/legal.html', app), 'utf8'), /Synthetic contract/);
assert.match(await readFile(new URL('dist/types/technical.html', app), 'utf8'), /Synthetic specification/);
for (const name of ['privacy.html', 'privacy.md', 'sitemap.xml', 'llms.txt']) {
  assert.match(await readFile(new URL('dist/' + name, app), 'utf8'), /privacy/i);
}
console.log('Synthetic site build and privacy discovery output verified.');
