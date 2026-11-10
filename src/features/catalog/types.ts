import type { TaskFrequency } from '@/features/recurring/period';

export type CatalogCategoryKey = 'home' | 'kitchen';

export type CatalogScope = CatalogCategoryKey | 'all';

export type CatalogLink = { label: string; url: string };

export type CatalogNote = { text: string; links: CatalogLink[] };

export type CatalogSection = {
  /** `null` for presets that are a single flat list. */
  title: string | null;
  tasks: string[];
};

export type CatalogPreset = {
  /** Stable source ID, `H01`–`H22` or `B02`–`B20`. */
  id: string;
  category: CatalogCategoryKey;
  group: string;
  title: string;
  /** Suggested cadence as readable text. */
  cadence: string;
  /** Starting frequency for every task; `null` means one-off. */
  frequency: TaskFrequency | null;
  searchTerms: string[];
  aliases: string[];
  sections: CatalogSection[];
  notes: CatalogNote[];
};

export type CatalogGroup = {
  key: string;
  label: string;
  icon: string;
  presetIds: string[];
};

export type CatalogCategory = {
  key: CatalogCategoryKey;
  label: string;
  icon: string;
  guidance?: string;
  featured: string[];
  groups: CatalogGroup[];
};

export type Catalog = {
  source: string;
  categories: CatalogCategory[];
  presets: CatalogPreset[];
};
