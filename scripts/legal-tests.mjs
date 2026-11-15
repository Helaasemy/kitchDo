/**
 * Privacy / terms copy checks. Run: node scripts/legal-tests.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'node_modules/.cache/kdo-tests');
mkdirSync(outDir, { recursive: true });

const source = readFileSync(join(root, 'src/features/legal/content.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const outFile = join(outDir, 'legal-content.mjs');
writeFileSync(outFile, outputText);
const legal = await import(pathToFileURL(outFile).href);

const blob = (sections) =>
  sections.flatMap((s) => [s.title, ...s.paragraphs]).join('\n').toLowerCase();

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

test('privacy names the operator, contact, and account deletion', () => {
  const text = blob(legal.PRIVACY_SECTIONS);
  assert.match(text, /hamza elaasemy/);
  assert.match(text, /hamza93acimi@gmail.com/);
  assert.match(text, /delete your account/);
  assert.match(text, /revenuecat/);
  assert.match(text, /push token/);
  assert.match(text, /do not sell/);
  assert.match(text, /under 13/);
});

test('terms cover auto-renew, restore, and apple billing', () => {
  const text = blob(legal.TERMS_SECTIONS);
  assert.match(text, /auto-renewable/);
  assert.match(text, /24 hours/);
  assert.match(text, /restore purchases/);
  assert.match(text, /apple id/);
  assert.match(text, /owner pays|the owner pays/);
});

test('html pages match the in-app contact and update date', () => {
  const privacy = readFileSync(join(root, 'legal-site/privacy/index.html'), 'utf8');
  const terms = readFileSync(join(root, 'legal-site/terms/index.html'), 'utf8');
  assert.match(privacy, new RegExp(legal.LEGAL_CONTACT));
  assert.match(terms, new RegExp(legal.LEGAL_CONTACT));
  assert.match(privacy, new RegExp(legal.LEGAL_UPDATED));
  assert.match(terms, new RegExp(legal.LEGAL_UPDATED));
  assert.match(privacy, /do not sell/i);
  assert.match(terms, /auto-renewable/i);
});

console.log(`${passed} legal checks passed`);
