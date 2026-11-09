/**
 * Builds src/features/catalog/catalog.json from the editable Markdown source.
 * Run: node scripts/build-catalog.mjs
 *
 * The Markdown is the content source of truth. Groups for Home, icons,
 * featured picks, and extra search aliases are app-side config kept here.
 * Each preset also gets a starting task frequency derived from its cadence.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'docs/catalog/KitchDo_Home_and_Kitchen_Templates.md';
const OUTPUT = 'src/features/catalog/catalog.json';

const KITCHEN_GUIDANCE =
  "For food businesses, adapt each checklist to the site's own procedures, equipment instructions, and applicable local guidance.";

/** Kitchen groups come from the Markdown headings; keys stay stable if labels change. */
const KITCHEN_GROUPS = [
  { key: 'launch', label: 'Launch and setup', icon: 'rocket-outline' },
  { key: 'shifts', label: 'Opening and closing shifts', icon: 'time-outline' },
  {
    key: 'cleaning',
    label: 'Cleaning and equipment maintenance',
    icon: 'sparkles-outline',
  },
  { key: 'prep', label: 'Food preparation', icon: 'restaurant-outline' },
  { key: 'stock', label: 'Stock and deliveries', icon: 'cube-outline' },
  {
    key: 'safety',
    label: 'Food safety and inspections',
    icon: 'shield-checkmark-outline',
  },
  { key: 'team', label: 'Team training and handovers', icon: 'people-outline' },
  { key: 'cash', label: 'Cash and paperwork', icon: 'cash-outline' },
];

/** The source lists Home flat; these browse groups are app-side. */
const HOME_GROUPS = [
  {
    key: 'home_cleaning',
    label: 'Cleaning and tidying',
    icon: 'sparkles-outline',
    ids: ['H01', 'H02', 'H03', 'H06'],
  },
  {
    key: 'home_laundry',
    label: 'Laundry and linen',
    icon: 'shirt-outline',
    ids: ['H04', 'H05'],
  },
  {
    key: 'home_meals',
    label: 'Meal planning and shopping',
    icon: 'basket-outline',
    ids: ['H07', 'H12', 'H13', 'H14', 'H15'],
  },
  {
    key: 'home_cooking',
    label: 'Cooking',
    icon: 'flame-outline',
    ids: ['H16', 'H17'],
  },
  {
    key: 'home_upkeep',
    label: 'Appliances and upkeep',
    icon: 'construct-outline',
    ids: ['H08', 'H09', 'H10', 'H11'],
  },
  {
    key: 'home_admin',
    label: 'Paperwork and admin',
    icon: 'document-text-outline',
    ids: ['H18'],
  },
  {
    key: 'home_occasions',
    label: 'Moving and guests',
    icon: 'home-outline',
    ids: ['H20', 'H21'],
  },
  {
    key: 'home_care',
    label: 'Pets and plants',
    icon: 'paw-outline',
    ids: ['H19', 'H22'],
  },
];

const FEATURED = {
  home: ['H02', 'H03', 'H12', 'H14', 'H06', 'H18'],
  kitchen: ['B01', 'B02', 'B03', 'B04', 'B08', 'B12'],
};

/** Targeted aliases for the agreed search examples and everyday phrasing. */
const ALIASES = {
  H02: ['weekly cleaning', 'house cleaning'],
  H03: ['clean the bathroom', 'clean toilet'],
  H06: ['monthly reminders'],
  H10: ['monthly reminders'],
  H11: ['monthly reminders', 'fire alarm'],
  H12: ['Sunday meal plan'],
  H14: ['meal prep'],
  H15: ['meal prep for the freezer'],
  H18: ['monthly reminders', 'paperwork'],
  B01: ['open a cafe', 'new restaurant', 'start a food business'],
  B02: ['open the cafe', 'open cafe', 'morning opening'],
  B03: ['close the cafe', 'closing checklist'],
  B06: ['clean espresso machine', 'coffee machine cleaning'],
  B08: ['fridge and freezer stock', 'check a delivery'],
  B11: ['cash up', 'end of day cash', 'till count'],
  B14: ['paperwork', 'fridge temperature log'],
  B20: ['paperwork', 'health inspection'],
};

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

/**
 * "Daily before opening" → daily, "Weekly or monthly per site procedure" →
 * weekly. One-time, per-event, and mixed labels without "or" → null.
 */
function frequencyFromCadence(label) {
  const lower = label.trim().toLowerCase();
  const mentioned = FREQUENCIES.filter((f) => lower.includes(f));
  if (mentioned.length > 1 && !/\bor\b/.test(lower)) return null;
  return FREQUENCIES.find((f) => lower.startsWith(f)) ?? null;
}

function parseNoteLine(line) {
  const links = [];
  const text = line
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, label, url) => {
      links.push({ label, url });
      return '';
    })
    .trim();
  return { text, links };
}

function parse(markdown) {
  const lines = markdown.split(/\r?\n/);
  const presets = [];
  let category = null;
  let group = null;
  let current = null;
  let section = null;

  const finish = () => {
    if (!current) return;
    current.sections = current.sections.filter((s) => s.tasks.length > 0);
    presets.push(current);
    current = null;
    section = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '---' && category === 'kitchen') {
      finish();
      break;
    }
    if (line === '## Home' || line === '## Kitchen') {
      finish();
      category = line === '## Home' ? 'home' : 'kitchen';
      group = null;
      continue;
    }
    if (!category) continue;

    const presetMatch = /^#{3,4} ([HB]\d{2}) · (.+)$/.exec(line);
    if (presetMatch) {
      finish();
      const id = presetMatch[1];
      current = {
        id,
        category,
        group:
          category === 'kitchen'
            ? group
            : HOME_GROUPS.find((g) => g.ids.includes(id))?.key,
        title: presetMatch[2].trim(),
        cadence: '',
        frequency: null,
        searchTerms: [],
        aliases: ALIASES[id] ?? [],
        sections: [],
        notes: [],
      };
      if (!current.group) throw new Error(`${id} has no group`);
      section = { title: null, tasks: [] };
      current.sections.push(section);
      continue;
    }

    const groupMatch = /^### (.+)$/.exec(line);
    if (groupMatch && category === 'kitchen') {
      finish();
      const found = KITCHEN_GROUPS.find((g) => g.label === groupMatch[1].trim());
      if (!found) throw new Error(`Unknown Kitchen group: ${groupMatch[1]}`);
      group = found.key;
      continue;
    }
    if (!current) continue;

    const metaMatch = /^\*(.+) · Search terms — (.+)\*$/.exec(line);
    if (metaMatch) {
      current.cadence = metaMatch[1].trim();
      current.frequency = frequencyFromCadence(current.cadence);
      current.searchTerms = metaMatch[2].split(',').map((s) => s.trim());
      continue;
    }
    const sectionMatch = /^\*\*(.+)\*\*$/.exec(line);
    if (sectionMatch) {
      section = { title: sectionMatch[1].trim(), tasks: [] };
      current.sections.push(section);
      continue;
    }
    const taskMatch = /^- \[ \] (.+)$/.exec(line);
    if (taskMatch) {
      section.tasks.push(taskMatch[1].trim());
      continue;
    }
    if (line && !line.startsWith('#')) current.notes.push(parseNoteLine(line));
  }
  finish();
  return presets;
}

const presets = parse(readFileSync(join(root, SOURCE), 'utf8'));
for (const p of presets) {
  if (!p.cadence) throw new Error(`${p.id} is missing cadence`);
}

const groupsFor = (category, groups) =>
  groups.map(({ key, label, icon }) => ({
    key,
    label,
    icon,
    presetIds: presets
      .filter((p) => p.category === category && p.group === key)
      .map((p) => p.id),
  }));

const catalog = {
  source: SOURCE,
  categories: [
    {
      key: 'home',
      label: 'Home',
      icon: 'home-outline',
      featured: FEATURED.home,
      groups: groupsFor('home', HOME_GROUPS),
    },
    {
      key: 'kitchen',
      label: 'Kitchen',
      icon: 'restaurant-outline',
      guidance: KITCHEN_GUIDANCE,
      featured: FEATURED.kitchen,
      groups: groupsFor('kitchen', KITCHEN_GROUPS),
    },
  ],
  presets,
};

writeFileSync(join(root, OUTPUT), `${JSON.stringify(catalog, null, 2)}\n`);
const taskCount = presets.reduce(
  (n, p) => n + p.sections.reduce((m, s) => m + s.tasks.length, 0),
  0,
);
console.log(`Wrote ${OUTPUT}: ${presets.length} presets, ${taskCount} tasks`);
