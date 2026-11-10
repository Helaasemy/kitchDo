/**
 * Locale catalog checks. Run: node scripts/i18n-tests.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-i18n-'));

const LOCALE_IDS = [
  'en',
  'fr',
  'es',
  'pt',
  'de',
  'it',
  'id',
  'tr',
  'zh',
  'ja',
  'ko',
  'ar',
];

function load(rel) {
  const source = readFileSync(join(root, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const file = join(tmpDir, rel.replaceAll('/', '_'));
  writeFileSync(file, outputText);
  return import(pathToFileURL(file).href);
}

function keys(value, prefix = '') {
  if (typeof value !== 'object' || value == null) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [path] : keys(child, path);
  });
}

function placeholders(value) {
  return [...value.matchAll(/\{[a-zA-Z]+\}/g)].map((m) => m[0]).sort();
}

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const catalogs = {};
for (const id of LOCALE_IDS) {
  catalogs[id] = (await load(`src/i18n/${id}.ts`))[id];
}

const english = catalogs.en;

test('every locale catalog is present', () => {
  for (const id of LOCALE_IDS) {
    assert.equal(typeof catalogs[id], 'object', id);
  }
});

for (const id of LOCALE_IDS.filter((locale) => locale !== 'en')) {
  test(`${id} shares the same copy keys as English`, () => {
    assert.deepEqual(keys(catalogs[id]).sort(), keys(english).sort());
  });

  test(`${id} keeps placeholders aligned with English`, () => {
    const walk = (a, b, path) => {
      if (typeof a === 'string') {
        assert.deepEqual(placeholders(b), placeholders(a), path);
        return;
      }
      for (const key of Object.keys(a)) walk(a[key], b[key], path ? `${path}.${key}` : key);
    };
    walk(english, catalogs[id], '');
  });
}

console.log(`\n${passed} i18n checks passed`);
