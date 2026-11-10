import type {
  Catalog,
  CatalogCategory,
  CatalogCategoryKey,
  CatalogGroup,
  CatalogLink,
  CatalogNote,
  CatalogPreset,
  CatalogSection,
} from './types';

type TaskFrequency = NonNullable<CatalogPreset['frequency']>;

const CATEGORY_KEYS = new Set<CatalogCategoryKey>(['home', 'kitchen']);
const FREQUENCIES = new Set<TaskFrequency>(['daily', 'weekly', 'monthly']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isCategoryKey(value: unknown): value is CatalogCategoryKey {
  return typeof value === 'string' && CATEGORY_KEYS.has(value as CatalogCategoryKey);
}

function isFrequency(value: unknown): value is TaskFrequency {
  return typeof value === 'string' && FREQUENCIES.has(value as TaskFrequency);
}

/** Plain string, or `{ en, fr, … }` / localeString object. Missing locales fall back to English. */
export function pickLocalized(value: unknown, locale: string): string | null {
  const direct = asString(value);
  if (direct) return direct;
  if (!isRecord(value)) return null;
  return asString(value[locale]) ?? asString(value.en);
}

function pickLocalizedList(value: unknown, locale: string): string[] {
  if (isRecord(value) && !Array.isArray(value)) {
    const picked = value[locale] ?? value.en;
    if (Array.isArray(picked)) {
      return picked.flatMap((item) => {
        const text = pickLocalized(item, locale);
        return text ? [text] : [];
      });
    }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = pickLocalized(item, locale);
    return text ? [text] : [];
  });
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function derivedFrequency(sections: CatalogSection[]): TaskFrequency | null {
  if (sections.length === 0) return null;
  const first = sections[0].frequency;
  return sections.every((section) => section.frequency === first) ? first : null;
}

function mapSection(value: unknown, locale: string): CatalogSection | null {
  if (!isRecord(value)) return null;
  const tasks = pickLocalizedList(value.tasks, locale)
    .map((task) => task.trim())
    .filter(Boolean);
  if (tasks.length === 0) return null;
  return {
    title: pickLocalized(value.title, locale),
    frequency: isFrequency(value.frequency) ? value.frequency : null,
    tasks,
  };
}

function mapLink(value: unknown, locale: string): CatalogLink | null {
  if (!isRecord(value)) return null;
  const label = pickLocalized(value.label, locale);
  const url = asString(value.url);
  if (!label || !url) return null;
  return { label, url };
}

function mapNote(value: unknown, locale: string): CatalogNote | null {
  if (!isRecord(value)) return null;
  const text = pickLocalized(value.text, locale);
  if (!text) return null;
  const links = Array.isArray(value.links)
    ? value.links.flatMap((link) => {
        const mapped = mapLink(link, locale);
        return mapped ? [mapped] : [];
      })
    : [];
  return { text, links };
}

function mapGroup(value: unknown, locale: string): CatalogGroup | null {
  if (!isRecord(value)) return null;
  const key = asString(value.key);
  const label = pickLocalized(value.label, locale);
  const icon = asString(value.icon) ?? 'ellipse-outline';
  if (!key || !label) return null;
  return {
    key,
    label,
    icon,
    presetIds: asIdList(value.presetIds),
  };
}

function mapCategory(value: unknown, locale: string): CatalogCategory | null {
  if (!isRecord(value)) return null;
  if (!isCategoryKey(value.key)) return null;
  const label = pickLocalized(value.label, locale);
  const icon = asString(value.icon) ?? 'ellipse-outline';
  if (!label) return null;
  const groups = Array.isArray(value.groups)
    ? value.groups.flatMap((group) => {
        const mapped = mapGroup(group, locale);
        return mapped ? [mapped] : [];
      })
    : [];
  const guidance = pickLocalized(value.guidance, locale) ?? undefined;
  return {
    key: value.key,
    label,
    icon,
    ...(guidance ? { guidance } : {}),
    featured: asIdList(value.featured),
    groups,
  };
}

function mapPreset(value: unknown, locale: string): CatalogPreset | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const title = pickLocalized(value.title, locale);
  const cadence = pickLocalized(value.cadence, locale);
  if (!id || !title || !cadence) return null;
  if (!isCategoryKey(value.category)) return null;
  const group = asString(value.group);
  if (!group) return null;
  const fallbackFrequency = isFrequency(value.frequency) ? value.frequency : null;
  const sections = Array.isArray(value.sections)
    ? value.sections.flatMap((section) => {
        const mapped = mapSection(section, locale);
        if (!mapped) return [];
        return [
          {
            ...mapped,
            frequency: mapped.frequency ?? fallbackFrequency,
          },
        ];
      })
    : [];
  if (sections.length === 0) return null;
  const notes = Array.isArray(value.notes)
    ? value.notes.flatMap((note) => {
        const mapped = mapNote(note, locale);
        return mapped ? [mapped] : [];
      })
    : [];
  return {
    id,
    category: value.category,
    group,
    title,
    cadence,
    frequency: derivedFrequency(sections),
    searchTerms: pickLocalizedList(value.searchTerms, locale),
    aliases: pickLocalizedList(value.aliases, locale),
    sections,
    notes,
  };
}

export function catalogFromSanity(
  value: unknown,
  locale = 'en',
): Catalog | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.categories) || !Array.isArray(value.presets)) return null;
  const categories = value.categories.flatMap((category) => {
    const mapped = mapCategory(category, locale);
    return mapped ? [mapped] : [];
  });
  const presets = value.presets.flatMap((preset) => {
    const mapped = mapPreset(preset, locale);
    return mapped ? [mapped] : [];
  });
  if (categories.length === 0 || presets.length === 0) return null;
  return {
    source: asString(value.source) ?? 'sanity:production',
    categories,
    presets,
  };
}
