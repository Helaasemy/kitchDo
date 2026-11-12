/**
 * Recurring task checks (no Jest). Run: node scripts/recurring-tests.mjs
 * Transpiles the real period and grouping modules with the project's TypeScript.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DateTime } from 'luxon';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Inside node_modules so the transpiled `luxon` import resolves.
const outDir = join(root, 'node_modules/.cache/kdo-tests');
mkdirSync(outDir, { recursive: true });

const load = async (relPath, outName) => {
  const source = readFileSync(join(root, relPath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const outFile = join(outDir, outName);
  writeFileSync(outFile, outputText);
  return import(pathToFileURL(outFile).href);
};
const period = await load('src/features/recurring/period.ts', 'period.mjs');
const grouping = await load('src/features/recurring/grouping.ts', 'grouping.mjs');
const matchCatalog = await load('src/features/recurring/matchCatalog.ts', 'matchCatalog.mjs');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const zone = 'Europe/Stockholm';
const at = (iso) => DateTime.fromISO(iso, { zone });
const fmt = (dt) => dt.toFormat('yyyy-MM-dd HH:mm');

test('daily period is the calendar day', () => {
  assert.equal(period.periodKey('daily', at('2026-11-11T00:00')), 'daily:2026-11-11');
  assert.equal(period.periodKey('daily', at('2026-11-11T23:59')), 'daily:2026-11-11');
  assert.equal(period.periodKey('daily', at('2026-11-12T00:00')), 'daily:2026-11-12');
  assert.equal(fmt(period.periodEnd('daily', at('2026-11-11T09:00'))), '2026-11-11 23:59');
});

test('weekly period runs Monday to Sunday', () => {
  // 2026-11-09 is a Monday.
  assert.equal(period.periodKey('weekly', at('2026-11-09T00:01')), 'weekly:2026-11-09');
  assert.equal(period.periodKey('weekly', at('2026-11-15T23:59')), 'weekly:2026-11-09');
  assert.equal(period.periodKey('weekly', at('2026-11-16T00:00')), 'weekly:2026-11-16');
  assert.equal(fmt(period.periodEnd('weekly', at('2026-11-11T09:00'))), '2026-11-15 23:59');
});

test('monthly period is the calendar month, including February', () => {
  assert.equal(period.periodKey('monthly', at('2026-11-30T22:00')), 'monthly:2026-11-01');
  assert.equal(period.periodKey('monthly', at('2026-12-01T00:00')), 'monthly:2026-12-01');
  assert.equal(fmt(period.periodEnd('monthly', at('2028-02-10T08:00'))), '2028-02-29 23:59');
});

test('periods hold across a DST change', () => {
  assert.equal(period.periodKey('weekly', at('2026-03-29T12:00')), 'weekly:2026-03-23');
  assert.equal(period.periodKey('weekly', at('2026-03-30T00:30')), 'weekly:2026-03-30');
  assert.equal(period.periodKey('daily', at('2026-10-25T02:30')), 'daily:2026-10-25');
});

test('period keys round-trip; other strings are rejected', () => {
  assert.deepEqual(period.parsePeriodKey('weekly:2026-11-09'), {
    frequency: 'weekly',
    start: '2026-11-09',
  });
  assert.equal(period.parsePeriodKey('yearly:2026-01-01'), null);
  assert.equal(period.parsePeriodKey('daily:2026-1-1'), null);
  assert.ok(period.isTaskFrequency('monthly'));
  assert.ok(period.isTaskFrequency('once'));
  assert.ok(period.isRepeatFrequency('daily'));
  assert.ok(!period.isRepeatFrequency('once'));
});

test('one-off ticks are permanent and keyed by item', () => {
  assert.equal(period.periodKey('once', at('2026-11-11T09:00'), 'item-a'), 'once:item-a');
  assert.equal(period.periodKey('once', at('2026-11-12T09:00'), 'item-a'), 'once:item-a');
  assert.notEqual(
    period.periodKey('once', at('2026-11-11T09:00'), 'item-a'),
    period.periodKey('once', at('2026-11-11T09:00'), 'item-b'),
  );
  assert.deepEqual(period.parsePeriodKey('once:item-a'), {
    frequency: 'once',
    start: 'item-a',
  });
});

test('a tick from last week no longer counts this week', () => {
  const lastWeek = period.periodKey('weekly', at('2026-11-08T18:00'));
  const thisWeek = period.periodKey('weekly', at('2026-11-10T08:00'));
  assert.notEqual(lastWeek, thisWeek);
});

test('Today groups tasks by frequency, then template, keeping order', () => {
  const task = (itemId, templateId, frequency, done = false) => ({
    itemId,
    templateId,
    templateTitle: templateId.toUpperCase(),
    frequency,
    done,
  });
  const groups = grouping.groupByFrequencyAndTemplate([
    task('a1', 'open', 'daily', true),
    task('b1', 'deep', 'weekly'),
    task('a2', 'open', 'daily'),
    task('c1', 'close', 'daily', true),
    task('b2', 'deep', 'weekly', true),
  ]);
  assert.deepEqual(
    groups.daily.map((g) => [g.templateId, g.tasks.map((t) => t.itemId), g.doneCount]),
    [
      ['open', ['a2', 'a1'], 1],
      ['close', ['c1'], 1],
    ],
  );
  assert.deepEqual(
    groups.weekly[0].tasks.map((t) => t.itemId),
    ['b1', 'b2'],
  );
  assert.deepEqual(
    groups.weekly.map((g) => [g.templateId, g.tasks.length, g.doneCount]),
    [['deep', 2, 1]],
  );
  assert.deepEqual(groups.monthly, []);
  assert.deepEqual(groups.once, []);
  assert.equal(grouping.countDone(groups.daily[0].tasks), 1);
  assert.deepEqual(
    grouping.openTasksFirst([
      { id: 'a', done: true },
      { id: 'b', done: false },
      { id: 'c', done: true },
      { id: 'd', done: false },
    ]).map((t) => t.id),
    ['b', 'd', 'a', 'c'],
  );
});

test('one-off tasks group separately from repeating ones', () => {
  const groups = grouping.groupByFrequencyAndTemplate([
    {
      itemId: 'a1',
      templateId: 'open',
      templateTitle: 'OPEN',
      frequency: 'once',
      done: true,
    },
    {
      itemId: 'a2',
      templateId: 'open',
      templateTitle: 'OPEN',
      frequency: 'daily',
      done: false,
    },
  ]);
  assert.deepEqual(
    groups.once.map((g) => [g.templateId, g.tasks.map((t) => t.itemId), g.doneCount]),
    [['open', ['a1'], 1]],
  );
  assert.equal(groups.daily[0].tasks[0].itemId, 'a2');
});

const preset = (id, title, frequency, tasks, aliases = []) => ({
  id,
  title,
  frequency,
  aliases,
  sections: [{ title: null, tasks }],
});

test('library templates match a unique title even after tasks are edited', () => {
  const presets = [
    preset('H01', 'Evening kitchen reset', 'daily', ['Wipe the hob.', 'Rinse the sink.']),
    preset('H02', 'Weekly home reset', 'weekly', ['Vacuum.', 'Change sheets.']),
  ];
  const found = matchCatalog.matchPresetForTemplate(presets, {
    title: 'Evening kitchen reset',
    items: [{ title: 'My own extra step' }],
  });
  assert.equal(found?.id, 'H01');
  assert.equal(found?.frequency, 'daily');
});

test('untitled copies still match when most task names overlap', () => {
  const presets = [
    preset('H01', 'Evening kitchen reset', 'daily', [
      'Put away food.',
      'Wash dishes.',
      'Wipe counters.',
      'Rinse the sink.',
    ]),
    preset('H03', 'Fridge tidy', 'weekly', ['Bin old food.', 'Wipe shelves.']),
  ];
  const found = matchCatalog.matchPresetForTemplate(presets, {
    title: 'Copy of kitchen',
    items: [
      { title: 'Put away food.' },
      { title: 'Wash dishes.' },
      { title: 'Wipe counters.' },
      { title: 'Something extra' },
    ],
  });
  assert.equal(found?.id, 'H01');
});

test('one-off presets never match Today sections', () => {
  const found = matchCatalog.matchPresetForTemplate(
    [preset('H16', 'Dinner party', null, ['Set the table.', 'Cook.'])],
    { title: 'Dinner party', items: [{ title: 'Set the table.' }] },
  );
  assert.equal(found, undefined);
});

console.log(`\n${passed} recurring checks passed`);
