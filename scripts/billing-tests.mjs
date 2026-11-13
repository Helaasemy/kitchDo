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
  YEARLY_OFF_PERCENT,
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
  assert.equal(PLAN_LIMITS.light.yearUsd, PLAN_LIMITS.light.monthUsd * 10);
  assert.ok(Math.abs(PLAN_LIMITS.pro.yearUsd - PLAN_LIMITS.pro.monthUsd * 10) < 1);
  assert.equal(YEARLY_OFF_PERCENT, 17);
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

const { createPurchasesIdentitySync, isAnonymousAppUserId } = await load(
  'src/features/billing/identity.ts',
);

await test('anonymous ids are the RevenueCat generated prefix', () => {
  assert.equal(isAnonymousAppUserId('$RCAnonymousID:abc'), true);
  assert.equal(isAnonymousAppUserId('user-1'), false);
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakePurchases(start) {
  const calls = { configure: [], logIn: [], logOut: [] };
  let configured = Boolean(start.configured);
  let current = start.current ?? '';
  let inflight = 0;
  let maxInflight = 0;

  const begin = async () => {
    inflight += 1;
    maxInflight = Math.max(maxInflight, inflight);
    await delay(15);
    inflight -= 1;
  };

  const actions = {
    isConfigured: async () => configured,
    configure: async (userId) => {
      calls.configure.push(userId);
      await begin();
      configured = true;
      current = userId ?? '$RCAnonymousID:new';
    },
    getAppUserID: async () => current,
    logIn: async (userId) => {
      calls.logIn.push(userId);
      await begin();
      current = userId;
    },
    logOut: async () => {
      calls.logOut.push(true);
      await begin();
      current = '$RCAnonymousID:out';
    },
  };

  return { sync: createPurchasesIdentitySync(actions), calls, maxInflight: () => maxInflight };
}

await test('first sync configures with the user and does not also logIn', async () => {
  const { sync, calls } = fakePurchases({ configured: false });
  await sync.sync('maya');
  assert.deepEqual(calls.configure, ['maya']);
  assert.deepEqual(calls.logIn, []);
});

await test('already identified as that user skips logIn', async () => {
  const { sync, calls } = fakePurchases({ configured: true, current: 'maya' });
  await sync.sync('maya');
  assert.deepEqual(calls.logIn, []);
  assert.deepEqual(calls.configure, []);
});

await test('parallel syncs for the same user configure once and never overlap', async () => {
  const { sync, calls, maxInflight } = fakePurchases({ configured: false });
  await Promise.all([sync.sync('maya'), sync.sync('maya'), sync.sync('maya')]);
  assert.equal(calls.configure.length, 1);
  assert.deepEqual(calls.logIn, []);
  assert.equal(maxInflight(), 1);
});

await test('a later user waits for the in-flight identify instead of overlapping', async () => {
  const { sync, calls, maxInflight } = fakePurchases({ configured: true, current: 'anon' });
  const first = sync.sync('maya');
  await delay(5);
  await Promise.all([first, sync.sync('alex')]);
  assert.equal(calls.logIn.at(-1), 'alex');
  assert.equal(maxInflight(), 1);
});

await test('signed-out anonymous users do not logOut', async () => {
  const { sync, calls } = fakePurchases({
    configured: true,
    current: '$RCAnonymousID:device',
  });
  await sync.sync(null);
  assert.deepEqual(calls.logOut, []);
});

await test('signing out an identified user logs out once', async () => {
  const { sync, calls } = fakePurchases({ configured: true, current: 'maya' });
  await sync.sync(null);
  assert.equal(calls.logOut.length, 1);
});

console.log(`\n${passed} billing tests passed`);
