import AsyncStorage from '@react-native-async-storage/async-storage';

import { catalogFromSanity } from './fromSanity';
import type { Catalog } from './types';

const storageKey = (locale: string) => `kdo.catalogCache.v1.${locale}`;

type CachePayload = {
  fetchedAt: string;
  catalog: Catalog;
};

export async function readCatalogCache(locale = 'en'): Promise<Catalog | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    return catalogFromSanity(
      {
        categories: parsed.catalog?.categories,
        presets: parsed.catalog?.presets,
      },
      locale,
    );
  } catch {
    return null;
  }
}

export async function writeCatalogCache(
  catalog: Catalog,
  locale = 'en',
): Promise<void> {
  const payload: CachePayload = {
    fetchedAt: new Date().toISOString(),
    catalog,
  };
  await AsyncStorage.setItem(storageKey(locale), JSON.stringify(payload));
}
