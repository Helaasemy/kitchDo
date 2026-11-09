/**
 * Template catalog checks (no Jest). Run: node scripts/catalog-tests.mjs
 * Verifies catalog.json against the Markdown source and exercises the real
 * search module (transpiled with the project's TypeScript).
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(
  readFileSync(join(root, 'src/features/catalog/catalog.json'), 'utf8'),
);
const markdown = readFileSync(join(root, catalog.source), 'utf8');

const searchSource = readFileSync(join(root, 'src/features/catalog/search.ts'), 'utf8');
const { outputText } = ts.transpileModule(searchSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-catalog-'));
const tmp = join(tmpDir, 'search.mjs');
writeFileSync(tmp, outputText);
const { searchCatalog, normalizeText } = await import(pathToFileURL(tmp).href);

const signatureFile = join(tmpDir, 'signature.mjs');
writeFileSync(
  signatureFile,
  ts.transpileModule(
    readFileSync(join(root, 'src/features/catalog/signature.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
);
const { presetSignature, templateSignature } = await import(
  pathToFileURL(signatureFile).href
);

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const presets = catalog.presets;
const byId = new Map(presets.map((p) => [p.id, p]));
const tasksOf = (p) => p.sections.flatMap((s) => s.tasks);

// --- catalog data ---

test('42 presets with unique IDs H01–H22 and B01–B20', () => {
  assert.equal(presets.length, 42);
  assert.equal(new Set(presets.map((p) => p.id)).size, 42);
  const expected = [
    ...Array.from({ length: 22 }, (_, i) => `H${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 20 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`),
  ].sort();
  assert.deepEqual(presets.map((p) => p.id).sort(), expected);
});

test('321 tasks in total; Home has 22 presets, Kitchen has 20', () => {
  assert.equal(presets.reduce((n, p) => n + tasksOf(p).length, 0), 321);
  assert.equal(presets.filter((p) => p.category === 'home').length, 22);
  assert.equal(presets.filter((p) => p.category === 'kitchen').length, 20);
});

test('every Kitchen preset sits in its agreed group', () => {
  const expected = {
    launch: ['B01'],
    shifts: ['B02', 'B03', 'B16', 'B17', 'B18'],
    cleaning: ['B04', 'B05', 'B06', 'B19'],
    prep: ['B07'],
    stock: ['B08', 'B09'],
    safety: ['B13', 'B14', 'B20'],
    team: ['B10', 'B15'],
    cash: ['B11', 'B12'],
  };
  const kitchen = catalog.categories.find((c) => c.key === 'kitchen');
  assert.deepEqual(
    kitchen.groups.map((g) => g.label),
    [
      'Launch and setup',
      'Opening and closing shifts',
      'Cleaning and equipment maintenance',
      'Food preparation',
      'Stock and deliveries',
      'Food safety and inspections',
      'Team training and handovers',
      'Cash and paperwork',
    ],
  );
  for (const group of kitchen.groups) {
    assert.deepEqual(group.presetIds, expected[group.key], group.key);
    for (const id of group.presetIds) assert.equal(byId.get(id).group, group.key);
  }
});

test('every Home preset belongs to exactly one Home group', () => {
  const home = catalog.categories.find((c) => c.key === 'home');
  const ids = home.groups.flatMap((g) => g.presetIds);
  assert.equal(ids.length, 22);
  assert.equal(new Set(ids).size, 22);
});

test('categories are Home and Kitchen only; frequencies are not categories', () => {
  assert.deepEqual(catalog.categories.map((c) => c.key), ['home', 'kitchen']);
  for (const category of catalog.categories) {
    for (const group of category.groups) {
      assert.ok(!/^(daily|weekly|monthly)$/i.test(group.label), group.label);
    }
  }
});

test('titles, task wording and order match the Markdown source', () => {
  for (const preset of presets) {
    const heading = new RegExp(`^#{3,4} ${preset.id} · (.+)$`, 'm').exec(markdown);
    assert.ok(heading, preset.id);
    assert.equal(preset.title, heading[1].trim());
    const rest = markdown.slice(heading.index + heading[0].length);
    const end = rest.search(/^#{3,4} |^---$/m);
    const block = end === -1 ? rest : rest.slice(0, end);
    const sourceTasks = [...block.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1].trim());
    assert.deepEqual(tasksOf(preset), sourceTasks, preset.id);
    assert.ok(preset.cadence.length > 0, `${preset.id} cadence`);
    assert.ok(preset.searchTerms.length > 0, `${preset.id} search terms`);
  }
});

test('B01 Open a new café has 24 tasks in four ordered sections', () => {
  const b01 = byId.get('B01');
  assert.equal(b01.title, 'Open a new café');
  assert.deepEqual(
    b01.sections.map((s) => [s.title, s.tasks.length]),
    [
      ['Plan the business', 4],
      ['Check the premises and paperwork', 7],
      ['Set up the operation', 8],
      ['Rehearse and open', 5],
    ],
  );
});

test('starting task frequency follows the cadence label', () => {
  const expected = {
    H01: 'daily', H02: 'weekly', H04: 'weekly', H06: 'monthly', H08: 'monthly',
    H11: 'monthly', H15: null, H20: null, H22: 'weekly',
    B01: null, B02: 'daily', B03: 'daily', B05: 'weekly', B06: 'daily', B08: null,
    B13: null, B14: 'weekly', B15: null, B16: null, B19: 'monthly', B12: 'weekly',
  };
  for (const [id, frequency] of Object.entries(expected)) {
    assert.equal(byId.get(id).frequency, frequency, `${id} ${byId.get(id).cadence}`);
  }
  for (const p of presets) {
    assert.ok([null, 'daily', 'weekly', 'monthly'].includes(p.frequency), p.id);
  }
});

test('the two recipe links are kept as preview notes', () => {
  const withLinks = presets.filter((p) => p.notes.some((n) => n.links.length));
  assert.deepEqual(withLinks.map((p) => p.id), ['H16', 'H17']);
  assert.equal(
    byId.get('H16').notes[0].links[0].url,
    'https://www.nhs.uk/healthier-families/recipes/vegetable-and-lentil-soup/',
  );
  assert.equal(
    byId.get('H17').notes[0].links[0].url,
    'https://www.bbcgoodfood.com/recipes/roast-summer-vegetables-chickpeas',
  );
});

test('featured picks reference real presets in their own category', () => {
  for (const category of catalog.categories) {
    for (const id of category.featured) assert.equal(byId.get(id)?.category, category.key);
  }
});

// --- library copies ---

/** Mirror of what Use saves: fresh IDs, one item per task, preset frequency. */
function savedCopyOf(preset, edit = (x) => x) {
  const sections = [];
  const items = [];
  preset.sections.forEach((section, s) => {
    const sectionId = section.title ? `s${s}` : null;
    if (sectionId) sections.push({ id: sectionId, title: section.title });
    for (const task of section.tasks) {
      items.push({ sectionId, title: task, frequency: preset.frequency });
    }
  });
  return templateSignature(edit({ title: preset.title, sections, items }));
}

test('an unedited copy matches its preset, so Use stays disabled', () => {
  for (const preset of presets) {
    assert.equal(savedCopyOf(preset), presetSignature(preset), preset.id);
  }
});

test('editing a copy (task, frequency, title, or removal) counts as modified', () => {
  const b02 = byId.get('B02');
  const edits = [
    (c) => ({ ...c, items: c.items.map((i, n) => (n === 0 ? { ...i, title: 'Changed' } : i)) }),
    (c) => ({ ...c, items: c.items.map((i, n) => (n === 0 ? { ...i, frequency: 'weekly' } : i)) }),
    (c) => ({ ...c, title: 'My opening' }),
    (c) => ({ ...c, items: c.items.slice(1) }),
  ];
  for (const edit of edits) {
    assert.notEqual(savedCopyOf(b02, edit), presetSignature(b02));
  }
  // Whitespace-only differences are not edits.
  assert.equal(
    savedCopyOf(b02, (c) => ({ ...c, title: ` ${c.title} ` })),
    presetSignature(b02),
  );
});

// --- search ---

const top = (query, n, options) =>
  searchCatalog(catalog, query, options)
    .slice(0, n)
    .map((r) => r.preset.title);

test('normalizes case, accents, whitespace and punctuation', () => {
  assert.equal(normalizeText('  Open   a CAFÉ!! '), 'open a cafe');
  assert.deepEqual(top('open a cafe', 5), top('Open  a café?', 5));
});

test('"open a cafe" puts both café openings near the top', () => {
  const first = top('open a cafe', 3);
  assert.ok(first.includes('Open a new café'), first.join(' | '));
  assert.ok(first.includes('Open the café for service'), first.join(' | '));
});

test('"Sunday meal prep" finds Prep meals for the week first', () => {
  assert.equal(top('Sunday meal prep', 1)[0], 'Prep meals for the week');
});

test('"monthly reminders" finds monthly Home routines', () => {
  const first = top('monthly reminders', 6);
  for (const title of ['Monthly home deep clean', 'Monthly household paperwork']) {
    assert.ok(first.includes(title), first.join(' | '));
  }
});

test('"cash up" finds Close and reconcile the till', () => {
  assert.equal(top('cash up', 1)[0], 'Close and reconcile the till');
});

test('"clean espresso machine" finds Clean the espresso station', () => {
  assert.equal(top('clean espresso machine', 1)[0], 'Clean the espresso station');
});

test('"clean the bathroom" finds Clean the bathroom', () => {
  assert.equal(top('clean the bathroom', 1)[0], 'Clean the bathroom');
});

test('source document examples return their useful first results', () => {
  const examples = {
    'weekly cleaning': ['Weekly home reset', 'Clean the bathroom', 'Deep-clean the café'],
    paperwork: [
      'Monthly household paperwork',
      'Weekly café paperwork',
      'Prepare for a food safety visit',
    ],
    'Sunday meal prep': [
      'Plan meals for the week',
      'Prep meals for the week',
      'Batch-cook and freeze portions',
    ],
    'monthly reminders': [
      'Monthly home deep clean',
      'Monthly home maintenance walk-through',
      'Test smoke alarms',
      'Monthly household paperwork',
    ],
    fridge: [
      'Reset the fridge and pantry',
      'Receive a café delivery',
      'Review the café\'s food safety records',
    ],
  };
  for (const [query, titles] of Object.entries(examples)) {
    const first = top(query, titles.length + 1);
    for (const title of titles) assert.ok(first.includes(title), `${query}: ${first.join(' | ')}`);
  }
});

test('title and alias matches outrank task-only matches', () => {
  // "dishwasher" is in the H08 title and only in task text of H01 / B03.
  const results = searchCatalog(catalog, 'dishwasher');
  assert.equal(results[0].preset.id, 'H08');
});

test('scope filters to one category; empty and unmatched queries return nothing', () => {
  assert.ok(searchCatalog(catalog, 'clean', { scope: 'home' }).every((r) => r.preset.category === 'home'));
  assert.ok(searchCatalog(catalog, 'clean', { scope: 'kitchen' }).every((r) => r.preset.category === 'kitchen'));
  assert.deepEqual(searchCatalog(catalog, '   '), []);
  assert.deepEqual(searchCatalog(catalog, 'zzqx'), []);
});

test('search is deterministic', () => {
  assert.deepEqual(top('weekly cleaning', 10), top('weekly cleaning', 10));
});

console.log(`\n${passed} catalog checks passed`);
