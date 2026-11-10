/**
 * Local SQLite migration checks (no Jest). Run: node scripts/migration-tests.mjs
 * Runs the real migrator against Node's built-in SQLite through an adapter
 * that mimics the expo-sqlite async API.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(join(tmpdir(), 'kdo-migrate-'));
const transpile = (relPath, outName, rewrite = (s) => s) => {
  const { outputText } = ts.transpileModule(readFileSync(join(root, relPath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const file = join(outDir, outName);
  writeFileSync(file, rewrite(outputText));
  return file;
};
const migrationsFile = transpile('src/lib/storage/migrations.ts', 'migrations.mjs');
const migrateFile = transpile('src/lib/storage/migrate.ts', 'migrate.mjs', (s) =>
  s.replace("'./migrations'", "'./migrations.mjs'"),
);
const { SQLITE_MIGRATIONS } = await import(pathToFileURL(migrationsFile).href);
const { applyMigrations, LATEST_SQLITE_VERSION } = await import(
  pathToFileURL(migrateFile).href
);

/** expo-sqlite-shaped wrapper around node:sqlite. */
function openDb() {
  const raw = new DatabaseSync(':memory:');
  return {
    raw,
    async execAsync(sql) {
      raw.exec(sql);
    },
    async getAllAsync(sql, ...params) {
      return raw.prepare(sql).all(...params);
    },
    async runAsync(sql, ...params) {
      return raw.prepare(sql).run(...params);
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

const tables = (db) =>
  db.raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => r.name);
const versions = (db) =>
  db.raw
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all()
    .map((r) => r.version);
const count = (db, sql) => db.raw.prepare(sql).get().n;

/** Bring a database to exactly `version` the way an older app build would. */
async function migrateTo(db, version) {
  db.raw.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL)');
  for (const m of SQLITE_MIGRATIONS.filter((x) => x.version <= version)) {
    await db.withTransactionAsync(async () => {
      db.raw.exec(m.sql);
      db.raw.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version);
    });
  }
}

const EXPECTED_LOCAL = [
  'local_recurring_tasks',
  'local_task_ticks',
  'local_template_sources',
  'local_backups',
];

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

await test('versions are unique and contiguous from 1', () => {
  const list = SQLITE_MIGRATIONS.map((m) => m.version);
  assert.deepEqual(list, Array.from({ length: list.length }, (_, i) => i + 1));
  assert.equal(LATEST_SQLITE_VERSION, list.length);
});

await test('a fresh install reaches the latest schema', async () => {
  const db = openDb();
  await applyMigrations(db);
  assert.deepEqual(versions(db), SQLITE_MIGRATIONS.map((m) => m.version));
  for (const name of EXPECTED_LOCAL) assert.ok(tables(db).includes(name), name);
  for (const gone of ['local_repeats', 'local_repeat_rules']) {
    assert.ok(!tables(db).includes(gone), gone);
  }
});

await test('running the migrator again is a no-op', async () => {
  const db = openDb();
  await applyMigrations(db);
  await applyMigrations(db);
  assert.equal(versions(db).length, SQLITE_MIGRATIONS.length);
});

await test('a v3 device (section repeats) upgrades and drops device-only section runs', async () => {
  const db = openDb();
  await migrateTo(db, 3);
  const insertRun = db.raw.prepare(`INSERT INTO cached_runs (
    id, user_id, kitchen_id, template_id, template_revision_id, source, occurrence_key,
    title_snapshot, local_date, timezone_snapshot, scheduled_for, state, revision,
    updated_at, local_only
  ) VALUES (?, 'u', 'k', 't', 'r', 'manual', ?, 'Run', '2026-11-09', 'UTC',
    '2026-11-09T08:00:00Z', 'not_started', 1, '2026-11-09T08:00:00Z', ?)`);
  insertRun.run('server-run', 'manual:1', 0);
  insertRun.run('local-run', 'local:repeat:daily:r1:2026-11-09', 1);
  db.raw.exec(`INSERT INTO cached_run_items (
    id, user_id, kitchen_id, run_id, source_item_id, title_snapshot,
    response_type_snapshot, sort_order, outcome, revision, updated_at
  ) VALUES
    ('i1', 'u', 'k', 'server-run', 's1', 'A', 'checkbox', 0, 'pending', 1, 'x'),
    ('i2', 'u', 'k', 'local-run', 's1', 'A', 'checkbox', 0, 'pending', 1, 'x')`);
  db.raw.exec(`INSERT INTO local_repeat_rules (
    id, user_id, kitchen_id, template_id, cadence, local_time, effective_from
  ) VALUES ('r1', 'u', 'k', 't', 'daily', '08:00', 'x')`);

  await applyMigrations(db);
  assert.equal(versions(db).at(-1), LATEST_SQLITE_VERSION);
  assert.equal(count(db, "SELECT COUNT(*) n FROM cached_runs WHERE id = 'server-run'"), 1);
  assert.equal(count(db, "SELECT COUNT(*) n FROM cached_runs WHERE id = 'local-run'"), 0);
  assert.equal(count(db, "SELECT COUNT(*) n FROM cached_run_items WHERE run_id = 'local-run'"), 0);
  assert.equal(count(db, "SELECT COUNT(*) n FROM cached_run_items WHERE run_id = 'server-run'"), 1);
  assert.ok(!tables(db).includes('local_repeat_rules'));
  for (const name of EXPECTED_LOCAL) assert.ok(tables(db).includes(name), name);
});

await test('a v4 device (before library copies) gains local_template_sources and keeps ticks', async () => {
  const db = openDb();
  await migrateTo(db, 4);
  db.raw.exec(`INSERT INTO local_task_ticks VALUES
    ('u', 'k', 't', 'i', 'daily:2026-11-09', 'daily', 'Wipe', 'Close', '2026-11-09T20:00:00Z')`);
  assert.ok(!tables(db).includes('local_template_sources'));
  await applyMigrations(db);
  assert.ok(tables(db).includes('local_template_sources'));
  assert.equal(count(db, 'SELECT COUNT(*) n FROM local_task_ticks'), 1);
});

await test('a missing device-only table is recreated even when its version is recorded', async () => {
  const db = openDb();
  await applyMigrations(db);
  db.raw.exec('DROP TABLE local_template_sources');
  await applyMigrations(db);
  assert.ok(tables(db).includes('local_template_sources'));
});

await test('every table cleared on sign-out exists after migration', async () => {
  const db = openDb();
  await applyMigrations(db);
  const source = readFileSync(join(root, 'src/lib/storage/db.ts'), 'utf8');
  const syncedFn = source.slice(
    source.indexOf('export async function clearSyncedCache'),
    source.indexOf('export async function clearAccountLocalData'),
  );
  assert.ok(!/local_recurring_tasks|local_task_ticks|local_template_sources|local_backups/.test(syncedFn));
  const cleared = [...source.matchAll(/DELETE FROM (\w+) WHERE user_id/g)].map((m) => m[1]);
  assert.ok(cleared.length >= 9);
  for (const name of cleared) assert.ok(tables(db).includes(name), name);
});

await test('migrations never drop local-only tables', () => {
  const banned = /(DROP|DELETE FROM)\s+(IF EXISTS\s+)?local_(recurring_tasks|task_ticks|template_sources|backups)/i;
  for (const m of SQLITE_MIGRATIONS) {
    assert.ok(!banned.test(m.sql), `migration v${m.version} mutates local-only data`);
  }
});

await test('v5 devices gain hidden_at and local_backups', async () => {
  const db = openDb();
  await migrateTo(db, 5);
  db.raw.exec(`INSERT INTO local_recurring_tasks VALUES
    ('u', 'k', 't', 'i', 'daily', 'Wipe', NULL, 'Close', 0)`);
  await applyMigrations(db);
  assert.ok(tables(db).includes('local_backups'));
  const cols = db.raw.prepare('PRAGMA table_info(local_recurring_tasks)').all().map((c) => c.name);
  assert.ok(cols.includes('hidden_at'));
  assert.equal(count(db, 'SELECT COUNT(*) n FROM local_recurring_tasks'), 1);
});

await test('v6 is a no-op if hidden_at already exists', async () => {
  const db = openDb();
  await migrateTo(db, 5);
  db.raw.exec('ALTER TABLE local_recurring_tasks ADD COLUMN hidden_at TEXT');
  await applyMigrations(db);
  assert.equal(versions(db).at(-1), LATEST_SQLITE_VERSION);
  const cols = db.raw.prepare('PRAGMA table_info(local_recurring_tasks)').all().map((c) => c.name);
  assert.equal(cols.filter((c) => c === 'hidden_at').length, 1);
});

await test('hidden_at is added even when v6 is already recorded', async () => {
  const db = openDb();
  await migrateTo(db, 6);
  db.raw.exec('ALTER TABLE local_recurring_tasks DROP COLUMN hidden_at');
  await applyMigrations(db);
  const cols = db.raw.prepare('PRAGMA table_info(local_recurring_tasks)').all().map((c) => c.name);
  assert.ok(cols.includes('hidden_at'));
});

console.log(`\n${passed} migration checks passed`);
