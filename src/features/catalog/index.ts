import type { KitchenMode } from '@/i18n';

import { getCatalogSnapshot } from './CatalogProvider';
import type {
  Catalog,
  CatalogCategory,
  CatalogCategoryKey,
  CatalogGroup,
  CatalogPreset,
} from './types';

export * from './types';
export { normalizeText, searchCatalog, type CatalogSearchResult } from './search';
export {
  addPresetToTemplates,
  findUneditedCopy,
  forgetTemplateSource,
  isLibraryCopy,
  noteTemplateSaved,
} from './adopt';
export { presetSignature, templateSignature } from './signature';
export {
  CatalogProvider,
  getBundledCatalog,
  getCatalogSnapshot,
  useCatalog,
  useRefreshCatalog,
} from './CatalogProvider';

/** Live snapshot (cached Sanity catalog for the active locale). Prefer `useCatalog()` in UI. */
export const catalog: Catalog = new Proxy({} as Catalog, {
  get(_target, prop, receiver) {
    return Reflect.get(getCatalogSnapshot(), prop, receiver);
  },
});

export function getPreset(id: string): CatalogPreset | undefined {
  return getCatalogSnapshot().presets.find((preset) => preset.id === id);
}

export function getCategory(key: CatalogCategoryKey): CatalogCategory {
  const found = getCatalogSnapshot().categories.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown catalog category: ${key}`);
  return found;
}

export function findGroup(
  key: string,
): { category: CatalogCategory; group: CatalogGroup } | undefined {
  for (const category of getCatalogSnapshot().categories) {
    const group = category.groups.find((g) => g.key === key);
    if (group) return { category, group };
  }
  return undefined;
}

export function groupLabel(key: string): string {
  return findGroup(key)?.group.label ?? '';
}

/** Workspaces store `home` / `business`; the catalog shows Home / Kitchen. */
export function categoryForKitchenMode(mode: KitchenMode): CatalogCategoryKey {
  return mode === 'business' ? 'kitchen' : 'home';
}

export function presetTaskCount(preset: CatalogPreset): number {
  return preset.sections.reduce((n, s) => n + s.tasks.length, 0);
}
