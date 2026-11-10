import type { Catalog } from './types';

export type CatalogLoader = {
  readCache: (locale: string) => Promise<Catalog | null>;
  writeCache: (catalog: Catalog, locale: string) => Promise<void>;
  fetchRemote: (locale: string) => Promise<Catalog | null>;
};

/** Use cache for this locale if present. Fetch and save only on a miss. */
export async function loadCatalogForLocale(
  locale: string,
  loader: CatalogLoader,
): Promise<{ catalog: Catalog | null; fetched: boolean }> {
  const cached = await loader.readCache(locale);
  if (cached) return { catalog: cached, fetched: false };
  const remote = await loader.fetchRemote(locale);
  if (!remote) return { catalog: null, fetched: true };
  await loader.writeCache(remote, locale);
  return { catalog: remote, fetched: true };
}
