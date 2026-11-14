/**
 * RevenueCat kitchen identity (no Jest). Run: node scripts/billing-identity-tests.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-billing-identity-'));

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

const { createPurchasesIdentitySync } = await load('src/features/billing/identity.ts');

function mockSdk(start) {
  const calls = { configure: [], logIn: [], logOut: 0 };
  let configured = start.configured;
  let current = start.current;
  const sync = createPurchasesIdentitySync({
    isConfigured: async () => configured,
    configure: async (kitchenId) => {
      calls.configure.push(kitchenId);
      configured = true;
      current = kitchenId;
    },
    getAppUserID: async () => current,
    logIn: async (kitchenId) => {
      calls.logIn.push(kitchenId);
      current = kitchenId;
    },
  });
  return { sync, calls, getCurrent: () => current };
}

await test('signed-out does not configure or mint an anonymous customer', async () => {
  const sdk = mockSdk({ configured: false, current: '' });
  await sdk.sync.sync(null);
  assert.deepEqual(sdk.calls.configure, []);
  assert.deepEqual(sdk.calls.logIn, []);
  assert.equal(sdk.calls.logOut, 0);
});

await test('first kitchen configures RevenueCat as that kitchen', async () => {
  const sdk = mockSdk({ configured: false, current: '' });
  await sdk.sync.sync('kitchen-a');
  assert.deepEqual(sdk.calls.configure, ['kitchen-a']);
  assert.deepEqual(sdk.calls.logIn, []);
  assert.equal(sdk.getCurrent(), 'kitchen-a');
});

await test('same kitchen is a no-op', async () => {
  const sdk = mockSdk({ configured: true, current: 'kitchen-a' });
  await sdk.sync.sync('kitchen-a');
  assert.deepEqual(sdk.calls.configure, []);
  assert.deepEqual(sdk.calls.logIn, []);
});

await test('switching kitchens logs in as the new kitchen', async () => {
  const sdk = mockSdk({ configured: true, current: 'kitchen-a' });
  await sdk.sync.sync('kitchen-b');
  assert.deepEqual(sdk.calls.logIn, ['kitchen-b']);
  assert.equal(sdk.getCurrent(), 'kitchen-b');
});

await test('leaving a kitchen does not logOut', async () => {
  const sdk = mockSdk({ configured: true, current: 'kitchen-a' });
  await sdk.sync.sync(null);
  assert.deepEqual(sdk.calls.logIn, []);
  assert.equal(sdk.calls.logOut, 0);
  assert.equal(sdk.getCurrent(), 'kitchen-a');
});

console.log(`\n${passed} tests passed`);
