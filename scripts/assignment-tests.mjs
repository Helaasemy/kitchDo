/**
 * Two-level assignment (list default + task override). Run: node scripts/assignment-tests.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-assignment-'));

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

const {
  effectiveAssignee,
  isAssignedToMe,
  itemAssignmentFromPick,
  itemAssignmentKind,
  listAssigneeFromPick,
  normalizeItemAssignment,
  parseAssigneeMode,
} = await load('src/features/assignment/resolve.ts');

const maya = 'maya-id';
const alex = 'alex-id';
const inherit = { mode: 'inherit', userId: null };
const explicit = (userId) => ({ mode: 'explicit', userId });

await test('inherit uses the list default, including Anyone', () => {
  assert.equal(effectiveAssignee(maya, inherit), maya);
  assert.equal(effectiveAssignee(null, inherit), null);
});

await test('explicit person beats the list default', () => {
  assert.equal(effectiveAssignee(maya, explicit(alex)), alex);
  assert.equal(effectiveAssignee(null, explicit(alex)), alex);
});

await test('explicit Anyone unassigns even when the list has a default', () => {
  assert.equal(effectiveAssignee(maya, explicit(null)), null);
});

await test('inherit discards a leftover user id', () => {
  assert.deepEqual(normalizeItemAssignment({ mode: 'inherit', userId: maya }), inherit);
  assert.deepEqual(normalizeItemAssignment({ mode: 'explicit', userId: alex }), explicit(alex));
});

await test('unknown modes fall back to inherit', () => {
  assert.equal(parseAssigneeMode('explicit'), 'explicit');
  assert.equal(parseAssigneeMode('nope'), 'inherit');
  assert.equal(parseAssigneeMode(null), 'inherit');
});

await test('Mine is only the effective assignee, not Anyone', () => {
  assert.equal(isAssignedToMe(maya, maya), true);
  assert.equal(isAssignedToMe(alex, maya), false);
  assert.equal(isAssignedToMe(null, maya), false);
});

await test('row chrome distinguishes inherit, override, and Anyone', () => {
  assert.equal(itemAssignmentKind(maya, inherit), 'inherit');
  assert.equal(itemAssignmentKind(maya, explicit(alex)), 'override');
  assert.equal(itemAssignmentKind(maya, explicit(null)), 'anyone');
  assert.equal(itemAssignmentKind(null, inherit), 'anyone');
});

await test('picker maps list and task choices', () => {
  assert.equal(listAssigneeFromPick('anyone'), null);
  assert.equal(listAssigneeFromPick('member', maya), maya);
  assert.deepEqual(itemAssignmentFromPick('inherit'), inherit);
  assert.deepEqual(itemAssignmentFromPick('anyone'), explicit(null));
  assert.deepEqual(itemAssignmentFromPick('member', alex), explicit(alex));
});

console.log(`${passed} assignment tests passed`);
