/**
 * Appearance helpers (no Jest). Run: node scripts/appearance-tests.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-appearance-'));

function load(rel) {
  const source = readFileSync(join(root, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const file = join(tmpDir, rel.replaceAll('/', '_'));
  writeFileSync(file, outputText);
  return import(pathToFileURL(file).href);
}

const { isAppearancePreference, resolveScheme } = await load(
  'src/design/appearance.ts',
);

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

test('accepts only system, light, and dark', () => {
  assert.equal(isAppearancePreference('system'), true);
  assert.equal(isAppearancePreference('light'), true);
  assert.equal(isAppearancePreference('dark'), true);
  assert.equal(isAppearancePreference('auto'), false);
  assert.equal(isAppearancePreference(null), false);
});

test('forced light or dark ignores the system scheme', () => {
  assert.equal(resolveScheme('light', 'dark'), 'light');
  assert.equal(resolveScheme('dark', 'light'), 'dark');
});

test('system follows the device, defaulting to light', () => {
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  assert.equal(resolveScheme('system', 'light'), 'light');
  assert.equal(resolveScheme('system', null), 'light');
});

console.log(`${passed} appearance tests passed`);
