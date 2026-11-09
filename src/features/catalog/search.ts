import type {
  Catalog,
  CatalogCategoryKey,
  CatalogPreset,
  CatalogScope,
} from './types';

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'for',
  'in',
  'my',
  'of',
  'on',
  'the',
  'to',
]);

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stem(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

function hasToken(words: string[], token: string): boolean {
  return words.some((w) => w === token || (token.length >= 3 && w.startsWith(token)));
}

type Field = { words: string[]; phrase: string; weight: number };

const WEIGHT = { title: 30, alias: 20, group: 10, cadence: 10, task: 3 } as const;

export type CatalogSearchResult = { preset: CatalogPreset; score: number };

/**
 * Deterministic local search. Title and alias matches outrank matches found
 * only in task text; ties fall back to the preferred category, then source order.
 */
export function searchCatalog(
  catalog: Catalog,
  query: string,
  options: { scope?: CatalogScope; preferred?: CatalogCategoryKey } = {},
): CatalogSearchResult[] {
  const scope = options.scope ?? 'all';
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const queryPhrase = tokens.join(' ');

  const groupLabels = new Map<string, string>();
  for (const category of catalog.categories) {
    for (const group of category.groups) groupLabels.set(group.key, group.label);
  }

  const results: (CatalogSearchResult & { order: number })[] = [];

  catalog.presets.forEach((preset, order) => {
    if (scope !== 'all' && preset.category !== scope) return;

    const field = (text: string, weight: number): Field => {
      const words = tokenize(text);
      return { words, phrase: words.join(' '), weight };
    };
    const title = field(preset.title, WEIGHT.title);
    const aliases = [...preset.searchTerms, ...preset.aliases].map((a) =>
      field(a, WEIGHT.alias),
    );
    const group = field(groupLabels.get(preset.group) ?? '', WEIGHT.group);
    const cadence = field(preset.cadence, WEIGHT.cadence);
    const tasks = preset.sections
      .flatMap((s) => (s.title ? [s.title, ...s.tasks] : s.tasks))
      .map((task) => field(task, WEIGHT.task));
    const fields = [title, ...aliases, group, cadence, ...tasks];

    let score = 0;
    let matched = 0;
    let matchedInName = 0;
    for (const token of tokens) {
      let best = 0;
      for (const f of fields) {
        if (f.weight > best && hasToken(f.words, token)) best = f.weight;
      }
      if (best > 0) matched += 1;
      if (best >= WEIGHT.alias) matchedInName += 1;
      score += best;
    }
    if (matched === 0) return;

    if (title.phrase === queryPhrase) score += 400;
    else if (title.phrase.includes(queryPhrase)) score += 200;
    if (aliases.some((a) => a.phrase === queryPhrase)) score += 300;
    else if (aliases.some((a) => a.phrase.includes(queryPhrase))) score += 150;

    const allInTitle = tokens.every((tk) => hasToken(title.words, tk));
    if (allInTitle) score += 120;
    else if (aliases.some((a) => tokens.every((tk) => hasToken(a.words, tk)))) {
      score += 100;
    } else if (matchedInName === tokens.length) score += 60;
    if (matched === tokens.length) score += 40;

    results.push({ preset, score, order });
  });

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = a.preset.category === options.preferred ? 0 : 1;
    const pb = b.preset.category === options.preferred ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.order - b.order;
  });

  return results.map(({ preset, score }) => ({ preset, score }));
}
