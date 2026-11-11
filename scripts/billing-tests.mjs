/**
 * Kitchen plan helpers (no Jest). Run: node scripts/billing-tests.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-billing-'));

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
  PLAN_LIMITS,
  canAddList,
  canAddPerson,
  canDowngradeTo,
  isListLimitError,
  isPeopleLimitError,
  planForPeople,
} = await load('src/features/billing/plans.ts');

await test('free is 5 lists and 1 person', () => {
  assert.equal(PLAN_LIMITS.free.lists, 5);
  assert.equal(PLAN_LIMITS.free.people, 1);
  assert.equal(canAddList('free', 4), true);
  assert.equal(canAddList('free', 5), false);
  assert.equal(canAddPerson('free', 0), true);
  assert.equal(canAddPerson('free', 1), false);
});

await test('light and pro have unlimited lists', () => {
  assert.equal(canAddList('light', 99), true);
  assert.equal(canAddList('pro', 99), true);
  assert.equal(canAddPerson('light', 1), true);
  assert.equal(canAddPerson('light', 2), false);
  assert.equal(canAddPerson('pro', 5), true);
  assert.equal(canAddPerson('pro', 6), false);
});

await test('yearly is 10 months of the monthly price', () => {
  assert.equal(PLAN_LIMITS.light.yearKr, PLAN_LIMITS.light.monthKr * 10);
  assert.equal(PLAN_LIMITS.pro.yearKr, PLAN_LIMITS.pro.monthKr * 10);
});

await test('planForPeople maps counts onto the cheapest fitting plan', () => {
  assert.equal(planForPeople(1), 'free');
  assert.equal(planForPeople(2), 'light');
  assert.equal(planForPeople(6), 'pro');
  assert.equal(planForPeople(7), null);
});

await test('downgrade is refused while over the lower cap', () => {
  assert.equal(canDowngradeTo('free', { listCount: 5, peopleCount: 1 }), true);
  assert.equal(canDowngradeTo('free', { listCount: 6, peopleCount: 1 }), false);
  assert.equal(canDowngradeTo('light', { listCount: 20, peopleCount: 2 }), true);
  assert.equal(canDowngradeTo('light', { listCount: 20, peopleCount: 3 }), false);
  assert.equal(canDowngradeTo('pro', { listCount: 20, peopleCount: 6 }), true);
});

await test('server error messages are recognized', () => {
  assert.equal(isListLimitError('list limit reached'), true);
  assert.equal(isPeopleLimitError('people limit reached'), true);
  assert.equal(isPeopleLimitError('kitchen is full'), true);
});

const sql = readFileSync(
  join(root, 'supabase/migrations/20261111000001_kdo_kitchen_plans.sql'),
  'utf8',
);

await test('plan migration enforces slots and set_kitchen_plan', () => {
  for (const needle of [
    "plan text not null default 'free'",
    'private.kdo_require_list_slot',
    'private.kdo_require_people_slot',
    'list limit reached',
    'people limit reached',
    'kitchen is full',
    'plan too small',
    'set_kitchen_plan',
    'kdo_templates_list_slot',
    'kdo_members_people_slot',
  ]) {
    assert.ok(sql.includes(needle), needle);
  }
});

console.log(`\n${passed} billing tests passed`);
