import type { CatalogPreset } from '@/features/catalog/types';

const norm = (value: string) => value.trim().toLowerCase();

export type MatchablePreset = Pick<
  CatalogPreset,
  'id' | 'title' | 'frequency' | 'aliases' | 'sections'
>;

function taskTitles(preset: Pick<MatchablePreset, 'sections'>): string[] {
  return preset.sections.flatMap((section) => section.tasks.map(norm));
}

function scorePreset(
  preset: Pick<MatchablePreset, 'sections'>,
  itemTitles: Set<string>,
): number {
  return taskTitles(preset).filter((title) => itemTitles.has(title)).length;
}

/**
 * Find the library preset a saved template was copied from. Title (or alias)
 * is enough when it is unique; otherwise item titles have to overlap.
 */
export function matchPresetForTemplate<T extends MatchablePreset>(
  presets: T[],
  template: { title: string; items: { title: string }[] },
): T | undefined {
  const withFrequency = presets.filter(
    (preset) =>
      preset.frequency === 'daily' ||
      preset.frequency === 'weekly' ||
      preset.frequency === 'monthly',
  );
  if (withFrequency.length === 0 || template.items.length === 0) return undefined;

  const title = norm(template.title);
  const titleMatches = withFrequency.filter(
    (preset) =>
      norm(preset.title) === title ||
      preset.aliases.some((alias) => norm(alias) === title),
  );
  if (titleMatches.length === 1) return titleMatches[0];

  const itemTitles = new Set(template.items.map((item) => norm(item.title)));
  const pool = titleMatches.length > 0 ? titleMatches : withFrequency;
  let best: T | undefined;
  let bestScore = 0;
  for (const preset of pool) {
    const score = scorePreset(preset, itemTitles);
    if (score > bestScore) {
      best = preset;
      bestScore = score;
    }
  }
  const needed =
    titleMatches.length > 0 ? 1 : Math.max(3, Math.ceil(template.items.length * 0.6));
  return best && bestScore >= needed ? best : undefined;
}
