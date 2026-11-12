/**
 * Kitchen membership helpers (no Jest). Run: node scripts/membership-tests.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-membership-'));

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

const { formatJoinCode, normalizeJoinCode, parseJoinPayload } = await load(
  'src/features/membership/joinCode.ts',
);
const {
  effectivePermissions,
  canLeaveKitchen,
  isOnboardingComplete,
} = await load('src/features/membership/permissions.ts');

await test('formats an 8-character code as XXXX-XXXX', () => {
  assert.equal(formatJoinCode('A1B2C3D4'), 'A1B2-C3D4');
});

await test('normalizes dashes, spaces, and ambiguous letters', () => {
  assert.equal(normalizeJoinCode('a1b2-c3d4'), 'A1B2C3D4');
  assert.equal(normalizeJoinCode('o1i0 l1o2'), '01101102');
});

await test('rejects codes that are not 8 Crockford characters', () => {
  assert.equal(normalizeJoinCode('SHORT'), null);
  assert.equal(normalizeJoinCode('ABCDEFG!'), null);
  assert.equal(normalizeJoinCode(''), null);
});

await test('parses typed codes, dashed codes, and kitchdo join URLs', () => {
  assert.equal(parseJoinPayload('A1B2C3D4'), 'A1B2C3D4');
  assert.equal(parseJoinPayload('A1B2-C3D4'), 'A1B2C3D4');
  assert.equal(parseJoinPayload('kitchdo://join/A1B2C3D4'), 'A1B2C3D4');
  assert.equal(parseJoinPayload('kitchdo://join/A1B2-C3D4'), 'A1B2C3D4');
  assert.equal(parseJoinPayload('kitchdo://join?code=A1B2C3D4'), 'A1B2C3D4');
  assert.equal(parseJoinPayload('https://example.com/join/A1B2C3D4'), 'A1B2C3D4');
  assert.equal(parseJoinPayload('https://example.com'), null);
});

await test('admin has complete, edit, and invite regardless of stored flags', () => {
  const perms = effectivePermissions({
    role: 'admin',
    canComplete: false,
    canEditTemplates: false,
  });
  assert.deepEqual(perms, {
    canComplete: true,
    canEditTemplates: true,
    canInvite: true,
    isAdmin: true,
  });
});

await test('member flags control complete and edit; members cannot invite', () => {
  assert.deepEqual(
    effectivePermissions({
      role: 'member',
      canComplete: true,
      canEditTemplates: false,
    }),
    {
      canComplete: true,
      canEditTemplates: false,
      canInvite: false,
      isAdmin: false,
    },
  );
  assert.deepEqual(
    effectivePermissions({
      role: 'member',
      canComplete: false,
      canEditTemplates: true,
    }),
    {
      canComplete: false,
      canEditTemplates: true,
      canInvite: false,
      isAdmin: false,
    },
  );
});

await test('last admin cannot leave a kitchen that still has other people', () => {
  assert.equal(
    canLeaveKitchen({ isAdmin: true, adminCount: 1, memberCount: 3 }),
    false,
  );
  assert.equal(
    canLeaveKitchen({ isAdmin: true, adminCount: 2, memberCount: 3 }),
    true,
  );
  assert.equal(
    canLeaveKitchen({ isAdmin: false, adminCount: 1, memberCount: 2 }),
    true,
  );
  assert.equal(
    canLeaveKitchen({ isAdmin: true, adminCount: 1, memberCount: 1 }),
    true,
  );
});

await test('onboarding is complete only with a profile and at least one kitchen', () => {
  assert.equal(isOnboardingComplete({ hasProfile: false, kitchenCount: 1 }), false);
  assert.equal(isOnboardingComplete({ hasProfile: true, kitchenCount: 0 }), false);
  assert.equal(isOnboardingComplete({ hasProfile: true, kitchenCount: 1 }), true);
});

await test('joining a kitchen completes onboarding without creating one', () => {
  assert.equal(
    isOnboardingComplete({ hasProfile: true, kitchenCount: 1 }),
    true,
    'redeeming a code as the first kitchen is enough',
  );
});

const sql = [
  'supabase/migrations/20261110000001_kdo_kitchen_members.sql',
  'supabase/migrations/20261110000002_kdo_membership_rls.sql',
  'supabase/migrations/20261110000003_kdo_membership_rpcs.sql',
  'supabase/migrations/20261110000004_kdo_membership_rpc_patches.sql',
  'supabase/migrations/20261110000005_kdo_membership_run_rpcs.sql',
  'supabase/migrations/20261111000001_kdo_kitchen_plans.sql',
]
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');

await test('migrations add members, invites, helpers, and join RPCs', () => {
  for (const needle of [
    'kdo_kitchen_members',
    'kdo_kitchen_invites',
    'private.kdo_is_member',
    'private.kdo_can_edit_templates',
    'create_kitchen_invite',
    'join_kitchen',
    'leave_kitchen',
    'last admin cannot leave while others remain',
    'display name required',
    'already a member of this kitchen',
    'already_member',
    'create_kitchen_invite',
    'update_member_permissions',
    'last admin cannot delete their account while others remain',
    'not allowed to edit templates in this kitchen',
    'this code has expired',
    'this code has been revoked',
    'set_kitchen_plan',
    'list limit reached',
    'people limit reached',
  ]) {
    assert.ok(sql.includes(needle), needle);
  }
});

await test('join payload from a scanned kitchdo URL is redeemable', () => {
  const generated = 'A1B2C3D4';
  assert.equal(parseJoinPayload(`kitchdo://join/${generated}`), generated);
  assert.equal(parseJoinPayload(`KITCHDO://JOIN/${generated.toLowerCase()}`), generated);
});

const {
  AUTH_OTP_LENGTH,
  isExistingAccountAuthError,
  isInvalidCredentialsError,
  normalizeAuthOtp,
} = await load('src/features/auth/authErrors.ts');

await test('treats signup enumeration errors as an existing account', () => {
  assert.equal(isExistingAccountAuthError('Invalid login credentials'), true);
  assert.equal(isExistingAccountAuthError('User already registered'), true);
  assert.equal(isExistingAccountAuthError('Email rate limit exceeded'), false);
});

await test('detects wrong-password sign-in errors', () => {
  assert.equal(isInvalidCredentialsError('Invalid login credentials'), true);
  assert.equal(isInvalidCredentialsError('Email not confirmed'), false);
});

await test('email codes are exactly 6 digits', () => {
  assert.equal(AUTH_OTP_LENGTH, 6);
  assert.equal(normalizeAuthOtp('847291'), '847291');
  assert.equal(normalizeAuthOtp('84 72 91'), '847291');
  assert.equal(normalizeAuthOtp('84729'), null);
  assert.equal(normalizeAuthOtp('8472911'), null);
});

console.log(`\n${passed} membership tests passed`);
