/**
 * Seed Sanity from bundled catalog.json.
 * Run: node scripts/import-catalog-to-sanity.mjs [--dry-run]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function loadEnv() {
  const text = readFileSync(join(root, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const projectId = process.env.EXPO_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.EXPO_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.EXPO_PUBLIC_SANITY_API_VERSION || '2025-02-19';
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || !dataset) {
  throw new Error('Missing EXPO_PUBLIC_SANITY_PROJECT_ID or EXPO_PUBLIC_SANITY_DATASET');
}
if (!dryRun && !token) {
  throw new Error('Missing SANITY_API_WRITE_TOKEN in .env');
}

const catalog = JSON.parse(
  readFileSync(join(root, 'src/features/catalog/catalog.json'), 'utf8'),
);

// Hyphens, not dots: IDs with `.` are path-namespaced and hidden from public reads.
const categoryId = (key) => `category-${key}`;
const groupId = (key) => `group-${key}`;
const presetId = (id) => `preset-${id}`;

const LOCALES = ['fr', 'es', 'pt', 'de', 'it', 'id', 'tr', 'zh', 'ja', 'ko', 'ar'];
const tables = Object.fromEntries(
  LOCALES.flatMap((locale) => {
    const file = join(root, `src/features/catalog/i18n/${locale}.json`);
    return existsSync(file) ? [[locale, JSON.parse(readFileSync(file, 'utf8'))]] : [];
  }),
);

const loc = (en, type = 'localeString') => {
  if (!en) return undefined;
  const value = { _type: type, en };
  for (const [locale, table] of Object.entries(tables)) {
    const translated = table[en];
    if (typeof translated === 'string' && translated.trim()) {
      value[locale] = translated;
    }
  }
  return value;
};
const locList = (items = []) =>
  items.flatMap((en, index) => {
    const value = loc(en);
    return value ? [{ ...value, _key: `k${index}` }] : [];
  });

const categoryDocs = catalog.categories.map((category, index) => ({
  _id: categoryId(category.key),
  _type: 'catalogCategory',
  key: category.key,
  label: loc(category.label),
  icon: category.icon,
  guidance: loc(category.guidance, 'localeText'),
  featured: [],
  sortOrder: index,
}));

const groupDocs = catalog.categories.flatMap((category) =>
  category.groups.map((group, index) => ({
    _id: groupId(group.key),
    _type: 'catalogGroup',
    key: group.key,
    label: loc(group.label),
    icon: group.icon,
    category: { _type: 'reference', _ref: categoryId(category.key) },
    sortOrder: index,
  })),
);

const presetDocs = catalog.presets.map((preset, index) => ({
  _id: presetId(preset.id),
  _type: 'catalogPreset',
  stableId: preset.id,
  title: loc(preset.title),
  cadence: loc(preset.cadence),
  category: { _type: 'reference', _ref: categoryId(preset.category) },
  group: { _type: 'reference', _ref: groupId(preset.group) },
  searchTerms: locList(preset.searchTerms),
  aliases: locList(preset.aliases),
  sections: preset.sections.map((section, sIndex) => ({
    _key: `s${sIndex}`,
    title: loc(section.title),
    frequency: section.frequency ?? preset.frequency ?? undefined,
    tasks: locList(section.tasks),
  })),
  notes: (preset.notes ?? []).map((note, nIndex) => ({
    _key: `n${nIndex}`,
    text: loc(note.text, 'localeText'),
    links: (note.links ?? []).map((link, lIndex) => ({
      _key: `l${lIndex}`,
      label: loc(link.label),
      url: link.url,
    })),
  })),
  sortOrder: index,
}));

const featuredPatches = catalog.categories.map((category) => ({
  id: categoryId(category.key),
  featured: (category.featured ?? []).map((id) => ({
    _type: 'reference',
    _ref: presetId(id),
    _key: id,
  })),
}));

const legacyIds = [
  ...catalog.categories.map((category) => `category.${category.key}`),
  ...catalog.categories.flatMap((category) =>
    category.groups.map((group) => `group.${group.key}`),
  ),
  ...catalog.presets.map((preset) => `preset.${preset.id}`),
];

console.log(
  `${dryRun ? 'dry-run ' : ''}categories=${categoryDocs.length} groups=${groupDocs.length} presets=${presetDocs.length}`,
);

if (dryRun) process.exit(0);

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

const docs = [...categoryDocs, ...groupDocs, ...presetDocs];
const createTx = client.transaction();
for (const doc of docs) {
  createTx.createOrReplace(doc);
}
await createTx.commit();

const featuredTx = client.transaction();
for (const patch of featuredPatches) {
  featuredTx.patch(patch.id, { set: { featured: patch.featured } });
}
await featuredTx.commit();

const cleanupTx = client.transaction();
for (const id of legacyIds) {
  cleanupTx.delete(id);
}
await cleanupTx.commit();
console.log('imported catalog into Sanity production');
