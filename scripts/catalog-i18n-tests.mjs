/**
 * Catalog translation table checks. Run: node scripts/catalog-i18n-tests.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'es', 'pt', 'de', 'it', 'id', 'tr', 'zh', 'ja', 'ko', 'ar'];

const source = JSON.parse(
  readFileSync(join(root, 'src/features/catalog/i18n/source-strings.json'), 'utf8'),
);
const catalog = JSON.parse(
  readFileSync(join(root, 'src/features/catalog/catalog.json'), 'utf8'),
);

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

test('source list covers every catalog string', () => {
  const needed = new Set();
  const add = (value) => {
    if (typeof value === 'string' && value.trim()) needed.add(value);
  };
  for (const category of catalog.categories) {
    add(category.label);
    add(category.guidance);
    for (const group of category.groups) add(group.label);
  }
  for (const preset of catalog.presets) {
    add(preset.title);
    add(preset.cadence);
    for (const term of preset.searchTerms ?? []) add(term);
    for (const alias of preset.aliases ?? []) add(alias);
    for (const section of preset.sections) {
      add(section.title);
      for (const task of section.tasks) add(task);
    }
    for (const note of preset.notes ?? []) {
      add(note.text);
      for (const link of note.links ?? []) add(link.label);
    }
  }
  assert.equal(source.length, needed.size);
  for (const value of needed) {
    assert.ok(source.includes(value), `missing source string: ${value}`);
  }
});

for (const locale of LOCALES) {
  test(`${locale} table has every source string`, () => {
    const file = join(root, `src/features/catalog/i18n/${locale}.json`);
    assert.ok(existsSync(file), `missing ${locale}.json`);
    const table = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(Object.keys(table).length, source.length, `${locale} key count`);
    for (const value of source) {
      const translated = table[value];
      assert.equal(typeof translated, 'string', `${locale} missing: ${value}`);
      assert.ok(translated.trim().length > 0, `${locale} empty: ${value}`);
    }
  });
}

console.log(`\n${passed} catalog-i18n checks passed`);
