/**
 * Sanity catalog mapper checks. Run: node scripts/catalog-sanity-tests.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'kdo-catalog-sanity-'));

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
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const { catalogFromSanity } = await load('src/features/catalog/fromSanity.ts');
const bundled = JSON.parse(
  readFileSync(join(root, 'src/features/catalog/catalog.json'), 'utf8'),
);

test('empty payload returns null', () => {
  assert.equal(catalogFromSanity(null), null);
  assert.equal(catalogFromSanity({ categories: [], presets: [] }), null);
});

test('maps a home preset fixture', () => {
  const mapped = catalogFromSanity({
    categories: [
      {
        key: 'home',
        label: 'Home',
        icon: 'home-outline',
        featured: ['H02'],
        groups: [
          {
            key: 'home_cleaning',
            label: 'Cleaning',
            icon: 'sparkles-outline',
            presetIds: ['H02'],
          },
        ],
      },
    ],
    presets: [
      {
        id: 'H02',
        category: 'home',
        group: 'home_cleaning',
        title: 'Weekly home reset',
        cadence: 'Weekly',
        searchTerms: ['weekly cleaning'],
        aliases: ['house cleaning'],
        sections: [{ title: null, frequency: 'weekly', tasks: ['Dust the main surfaces.'] }],
        notes: [],
      },
    ],
  });
  assert.equal(mapped.source, 'sanity:production');
  assert.equal(mapped.presets[0].id, 'H02');
  assert.equal(mapped.presets[0].frequency, 'weekly');
  assert.equal(mapped.presets[0].sections[0].frequency, 'weekly');
  assert.equal(mapped.categories[0].groups[0].presetIds[0], 'H02');
});

test('template frequency is null when sections disagree', () => {
  const mapped = catalogFromSanity({
    categories: [
      {
        key: 'kitchen',
        label: 'Kitchen',
        icon: 'restaurant-outline',
        featured: [],
        groups: [{ key: 'shifts', label: 'Shifts', icon: 'time-outline', presetIds: ['B02'] }],
      },
    ],
    presets: [
      {
        id: 'B02',
        category: 'kitchen',
        group: 'shifts',
        title: 'Open the café for service',
        cadence: 'Daily, with a weekly check',
        sections: [
          { title: 'Open', frequency: 'daily', tasks: ['Unlock the door.'] },
          { title: 'Weekly', frequency: 'weekly', tasks: ['Check the first-aid kit.'] },
        ],
        notes: [],
      },
    ],
  });
  assert.equal(mapped.presets[0].frequency, null);
  assert.equal(mapped.presets[0].sections[0].frequency, 'daily');
  assert.equal(mapped.presets[0].sections[1].frequency, 'weekly');
});

test('inherits template frequency onto sections when they omit it', () => {
  const mapped = catalogFromSanity({
    categories: [
      {
        key: 'home',
        label: 'Home',
        icon: 'home-outline',
        featured: [],
        groups: [{ key: 'home_cleaning', label: 'Cleaning', icon: 'sparkles-outline', presetIds: ['H01'] }],
      },
    ],
    presets: [
      {
        id: 'H01',
        category: 'home',
        group: 'home_cleaning',
        title: 'Evening kitchen reset',
        cadence: 'Daily',
        frequency: 'daily',
        sections: [{ title: null, tasks: ['Rinse the sink.'] }],
        notes: [],
      },
    ],
  });
  assert.equal(mapped.presets[0].sections[0].frequency, 'daily');
  assert.equal(mapped.presets[0].frequency, 'daily');
});

test('picks translated copy and falls back to English', () => {
  const payload = {
    categories: [
      {
        key: 'home',
        label: { en: 'Home', fr: 'Maison' },
        icon: 'home-outline',
        featured: [],
        groups: [
          {
            key: 'home_cleaning',
            label: { en: 'Cleaning', fr: 'Nettoyage' },
            icon: 'sparkles-outline',
            presetIds: ['H02'],
          },
        ],
      },
    ],
    presets: [
      {
        id: 'H02',
        category: 'home',
        group: 'home_cleaning',
        title: { en: 'Weekly home reset', fr: 'Reset hebdomadaire' },
        cadence: { en: 'Weekly' },
        sections: [
          {
            title: null,
            frequency: 'weekly',
            tasks: [{ en: 'Dust the main surfaces.', fr: 'Dépoussiérer les surfaces.' }],
          },
        ],
        notes: [],
      },
    ],
  };
  const fr = catalogFromSanity(payload, 'fr');
  assert.equal(fr.categories[0].label, 'Maison');
  assert.equal(fr.presets[0].title, 'Reset hebdomadaire');
  assert.equal(fr.presets[0].cadence, 'Weekly');
  assert.equal(fr.presets[0].sections[0].tasks[0], 'Dépoussiérer les surfaces.');

  const de = catalogFromSanity(payload, 'de');
  assert.equal(de.presets[0].title, 'Weekly home reset');
  assert.equal(de.presets[0].sections[0].tasks[0], 'Dust the main surfaces.');
});

test('bundled catalog.json round-trips through the mapper', () => {
  const mapped = catalogFromSanity(bundled);
  assert.ok(mapped);
  assert.equal(mapped.presets.length, bundled.presets.length);
  assert.deepEqual(
    mapped.presets.map((p) => p.id),
    bundled.presets.map((p) => p.id),
  );
  assert.deepEqual(mapped.categories[0].key, bundled.categories[0].key);
  assert.deepEqual(mapped.presets[0].sections[0].tasks, bundled.presets[0].sections[0].tasks);
  assert.equal(mapped.presets[0].sections[0].frequency, bundled.presets[0].frequency);
  assert.equal(mapped.presets[0].frequency, bundled.presets[0].frequency);
});

console.log(`\n${passed} catalog-sanity checks passed`);
