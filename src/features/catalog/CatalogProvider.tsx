import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useI18n } from '@/i18n';

import { getSanityClient } from '@/lib/sanity/client';

import { readCatalogCache, writeCatalogCache } from './cache';
import { catalogFromSanity } from './fromSanity';
import { loadCatalogForLocale } from './loadCatalog';
import { CATALOG_GROQ } from './sanityQuery';
import type { Catalog } from './types';

// Local catalog.json is the import seed / offline test fixture only.
// The app reads Sanity for the active UI language and caches it.
// import bundledData from './catalog.json';

const EMPTY_CATALOG: Catalog = {
  source: 'sanity:production',
  categories: [],
  presets: [],
};

let currentCatalog: Catalog = EMPTY_CATALOG;

export function getCatalogSnapshot(): Catalog {
  return currentCatalog;
}

export function getBundledCatalog(): Catalog {
  return EMPTY_CATALOG;
}

type CatalogValue = {
  catalog: Catalog;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogValue | null>(null);

async function fetchRemoteCatalog(locale: string): Promise<Catalog | null> {
  const client = getSanityClient();
  if (!client) return null;
  const payload = await client.fetch(CATALOG_GROQ, { locale });
  return catalogFromSanity(payload, locale);
}

const loader = {
  readCache: readCatalogCache,
  writeCache: writeCatalogCache,
  fetchRemote: fetchRemoteCatalog,
};

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [catalog, setCatalog] = useState<Catalog>(currentCatalog);
  const [ready, setReady] = useState(false);

  const apply = useCallback((next: Catalog) => {
    currentCatalog = next;
    setCatalog(next);
  }, []);

  const refresh = useCallback(async () => {
    const remote = await fetchRemoteCatalog(locale);
    if (!remote) return;
    apply(remote);
    await writeCatalogCache(remote, locale);
  }, [apply, locale]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { catalog: next } = await loadCatalogForLocale(locale, loader);
        if (!cancelled && next) apply(next);
      } catch {
        // Keep whatever snapshot we already have.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, locale]);

  const value = useMemo(() => ({ catalog, refresh }), [catalog, refresh]);

  if (!ready) return null;

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): Catalog {
  const value = useContext(CatalogContext);
  if (!value) {
    throw new Error('useCatalog must be used within CatalogProvider');
  }
  return value.catalog;
}

export function useRefreshCatalog(): () => Promise<void> {
  const value = useContext(CatalogContext);
  if (!value) {
    throw new Error('useRefreshCatalog must be used within CatalogProvider');
  }
  return value.refresh;
}
