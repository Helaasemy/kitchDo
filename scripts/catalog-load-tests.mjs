/**
 * Catalog load policy: cache once per locale, fetch only on miss.
 * Run: node scripts/catalog-load-tests.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-catalog-load-'));

function load(rel) {
  const source = readFileSync(join(root, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const file = join(tmpDir, rel.replaceAll('/', '_'));
  writeFileSync(file, outputText);
  return import(pathToFileURL(file).href);
}

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const sample = (title) => ({
  source: 'sanity:production',
  categories: [
    {
      key: 'home',
      label: 'Home',
      icon: 'home-outline',
      featured: [],
      groups: [],
    },
  ],
  presets: [
    {
      id: 'H02',
      category: 'home',
      group: 'home_cleaning',
      title,
      cadence: 'Weekly',
      frequency: 'weekly',
      searchTerms: [],
      aliases: [],
      sections: [{ title: null, frequency: 'weekly', tasks: ['Dust.'] }],
      notes: [],
    },
  ],
});

const { loadCatalogForLocale } = await load('src/features/catalog/loadCatalog.ts');

await test('cache hit does not fetch', async () => {
  let fetches = 0;
  let writes = 0;
  const cached = sample('Cached');
  const result = await loadCatalogForLocale('fr', {
    readCache: async () => cached,
    writeCache: async () => {
      writes += 1;
    },
    fetchRemote: async () => {
      fetches += 1;
      return sample('Remote');
    },
  });
  assert.equal(result.fetched, false);
  assert.equal(result.catalog.presets[0].title, 'Cached');
  assert.equal(fetches, 0);
  assert.equal(writes, 0);
});

await test('cache miss fetches once and saves', async () => {
  let fetches = 0;
  const stored = new Map();
  const result = await loadCatalogForLocale('ja', {
    readCache: async (locale) => stored.get(locale) ?? null,
    writeCache: async (catalog, locale) => {
      stored.set(locale, catalog);
    },
    fetchRemote: async () => {
      fetches += 1;
      return sample('リモート');
    },
  });
  assert.equal(result.fetched, true);
  assert.equal(result.catalog.presets[0].title, 'リモート');
  assert.equal(fetches, 1);
  assert.equal(stored.get('ja').presets[0].title, 'リモート');

  const second = await loadCatalogForLocale('ja', {
    readCache: async (locale) => stored.get(locale) ?? null,
    writeCache: async () => {
      throw new Error('should not write again');
    },
    fetchRemote: async () => {
      fetches += 1;
      return sample('again');
    },
  });
  assert.equal(second.fetched, false);
  assert.equal(second.catalog.presets[0].title, 'リモート');
  assert.equal(fetches, 1);
});

await test('language change fetches the new locale only', async () => {
  const stored = new Map();
  const fetches = [];
  const loader = {
    readCache: async (locale) => stored.get(locale) ?? null,
    writeCache: async (catalog, locale) => {
      stored.set(locale, catalog);
    },
    fetchRemote: async (locale) => {
      fetches.push(locale);
      return sample(locale);
    },
  };
  await loadCatalogForLocale('en', loader);
  await loadCatalogForLocale('ar', loader);
  await loadCatalogForLocale('en', loader);
  assert.deepEqual(fetches, ['en', 'ar']);
});

console.log(`\n${passed} catalog-load checks passed`);
