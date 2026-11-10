# Sanity Catalog CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sanity the live source of the template library, while the app still works offline from the bundled `catalog.json`.

**Architecture:** Public dataset `production` on project `qxq0r1rb` holds English catalog documents. The Expo app fetches them with `@sanity/client` (no token). A `CatalogProvider` hydrates on launch: bundled JSON first, then AsyncStorage cache, then network. Library screens read the in-memory catalog. User copies still live in SQLite/`kdo_templates` — Sanity never stores personal kitchens. Markdown + `catalog.json` remain the seed and offline fallback. Catalog copy stays English in this phase.

**Tech Stack:** Sanity Content Lake, local Studio in `studio/`, `@sanity/client`, Expo SDK 58, existing `Catalog` TypeScript types.

## Global Constraints

- Expo SDK 58; add native-compatible packages with `npx expo install`, not `npm add`.
- Secrets stay out of git. `.env` is gitignored. Write tokens never go in `EXPO_PUBLIC_*` or the app bundle.
- Organization ID `oPc6WwFuB` is not used in the app — project ID + dataset only.
- Dataset: `production`, public (unauthenticated reads). If it is still private, the library fetch will fail until visibility is flipped in [manage.sanity.io](https://www.sanity.io/manage).
- Project ID: `qxq0r1rb`.
- API version: `2025-02-19`.
- Do not change Supabase schema, RLS, or remote migrations.
- Do not translate library templates in this plan. UI i18n stays as-is; catalog documents are English.
- Do not replace `catalog.json` until a successful import is verified. Keep generating it from markdown for tests and offline fallback.
- Sanity MCP may be unavailable in this agent. Prefer a local Studio + a Node import script with a write token. Do not block on MCP.
- Native iOS/Android need no CORS. Add CORS later only if Expo web or a hosted Studio requires it.
- Do not commit unless the user asks.

---

## File map

| Path | Role |
|------|------|
| `.env.example`, `src/types/env.d.ts`, `docs/SETUP.md` | Public Sanity env vars |
| `src/lib/sanity/client.ts` | Read-only CDN client |
| `src/features/catalog/sanityQuery.ts` | GROQ + document shapes |
| `src/features/catalog/fromSanity.ts` | Map Sanity docs → `Catalog` |
| `src/features/catalog/cache.ts` | AsyncStorage cache |
| `src/features/catalog/CatalogProvider.tsx` | Hydrate + subscribe |
| `src/features/catalog/index.ts` | Snapshot accessors + hook re-exports |
| `src/app/_layout.tsx` | Wrap with `CatalogProvider` |
| Library screens under `src/app/(app)/(tabs)/templates/catalog/` | `useCatalog()` instead of static import |
| `studio/` | Local Sanity Studio + schema |
| `scripts/import-catalog-to-sanity.mjs` | Seed from `catalog.json` |
| `scripts/catalog-sanity-tests.mjs` | Mapper + fallback tests |
| `src/features/catalog/catalog.json` | Unchanged seed / offline fallback |

Out of scope files: `src/features/templates/api.ts`, recurring hydrate (keep bundled JSON unless a later task threads `getCatalogSnapshot()`), invite, i18n locales.

---

### Task 1: Public client config (no behavior change)

**Files:**
- Modify: `.env.example`
- Modify: `src/types/env.d.ts`
- Modify: `docs/SETUP.md`
- Create: `src/lib/sanity/client.ts`
- Modify: `.env` (local only, gitignored)

**Interfaces:**
- Consumes: project `qxq0r1rb`, dataset `production`
- Produces: `getSanityClient(): SanityClient | null`

- [ ] **Step 1: Add public env keys to `.env.example`**

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# Optional server-only (never ship in the app bundle):
# SUPABASE_SERVICE_ROLE_KEY=...

EXPO_PUBLIC_SANITY_PROJECT_ID=qxq0r1rb
EXPO_PUBLIC_SANITY_DATASET=production
EXPO_PUBLIC_SANITY_API_VERSION=2025-02-19
```

- [ ] **Step 2: Mirror keys in `src/types/env.d.ts`**

```ts
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    EXPO_PUBLIC_SANITY_PROJECT_ID?: string;
    EXPO_PUBLIC_SANITY_DATASET?: string;
    EXPO_PUBLIC_SANITY_API_VERSION?: string;
    SANITY_API_WRITE_TOKEN?: string;
  }
}
```

- [ ] **Step 3: Append the same three `EXPO_PUBLIC_SANITY_*` lines to local `.env`. Do not add a write token yet.**

- [ ] **Step 4: Document the keys in `docs/SETUP.md` under Environment.** Note: dataset must be public; write token is CLI-only.

- [ ] **Step 5: Install the client**

Run: `npx expo install @sanity/client`

Expected: `@sanity/client` added to `package.json` / `package-lock.json` at an SDK-compatible version.

- [ ] **Step 6: Create `src/lib/sanity/client.ts`**

```ts
import { createClient, type SanityClient } from '@sanity/client';

export function sanityConfig(): {
  projectId: string;
  dataset: string;
  apiVersion: string;
} | null {
  const projectId = process.env.EXPO_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.EXPO_PUBLIC_SANITY_DATASET?.trim();
  const apiVersion =
    process.env.EXPO_PUBLIC_SANITY_API_VERSION?.trim() || '2025-02-19';
  if (!projectId || !dataset) return null;
  return { projectId, dataset, apiVersion };
}

let cached: SanityClient | null | undefined;

export function getSanityClient(): SanityClient | null {
  if (cached !== undefined) return cached;
  const config = sanityConfig();
  if (!config) {
    cached = null;
    return cached;
  }
  cached = createClient({
    ...config,
    useCdn: true,
    perspective: 'published',
  });
  return cached;
}
```

No token. CDN + published perspective only.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

---

### Task 2: GROQ query, mapper, and tests

**Files:**
- Create: `src/features/catalog/sanityQuery.ts`
- Create: `src/features/catalog/fromSanity.ts`
- Create: `scripts/catalog-sanity-tests.mjs`
- Modify: `package.json` (add `test:catalog-sanity`)

**Interfaces:**
- Consumes: `Catalog` from `src/features/catalog/types.ts`
- Produces: `CATALOG_GROQ`, `catalogFromSanity(docs): Catalog | null`

Sanity document IDs (stable, used by the importer):

- Category: `category.home`, `category.kitchen`
- Group: `group.home_cleaning`, …
- Preset: `preset.H02`, `preset.B02`, …

- [ ] **Step 1: Write `src/features/catalog/sanityQuery.ts`**

```ts
export const CATALOG_GROQ = `{
  "categories": *[_type == "catalogCategory"] | order(sortOrder asc) {
    "key": key,
    label,
    icon,
    guidance,
    "featured": featured[]->stableId,
    "groups": *[_type == "catalogGroup" && category._ref == ^._id] | order(sortOrder asc) {
      "key": key,
      label,
      icon,
      "presetIds": *[_type == "catalogPreset" && group._ref == ^._id] | order(sortOrder asc).stableId
    }
  },
  "presets": *[_type == "catalogPreset"] | order(stableId asc) {
    "id": stableId,
    "category": category->key,
    "group": group->key,
    title,
    cadence,
    frequency,
    searchTerms,
    aliases,
    sections[] { title, tasks },
    notes[] { text, links[] { label, url } }
  }
}`;
```

- [ ] **Step 2: Write `src/features/catalog/fromSanity.ts`**

Validate the payload against the existing `Catalog` shape. If categories or presets are missing/empty, return `null` so the app keeps the bundled catalog.

```ts
import type { Catalog, CatalogCategoryKey } from './types';
import type { TaskFrequency } from '@/features/recurring/period';

const KEYS = new Set(['home', 'kitchen']);
const FREQ = new Set(['daily', 'weekly', 'monthly']);

function isCategoryKey(value: unknown): value is CatalogCategoryKey {
  return typeof value === 'string' && KEYS.has(value);
}

function isFrequency(value: unknown): value is TaskFrequency {
  return typeof value === 'string' && FREQ.has(value);
}

export function catalogFromSanity(value: unknown): Catalog | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { categories?: unknown; presets?: unknown };
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.presets)) return null;
  if (raw.categories.length === 0 || raw.presets.length === 0) return null;
  // Map + drop invalid rows. If nothing valid remains, return null.
  // Keep field names identical to Catalog in src/features/catalog/types.ts.
  // source: 'sanity:production'
}
```

Implement the full mapper in the file: require `id`, `title`, `category`, `group`, `cadence`, `sections` with `tasks: string[]`. `frequency` may be `null`. Skip unknown presets rather than throwing.

- [ ] **Step 3: Write `scripts/catalog-sanity-tests.mjs`**

Load `fromSanity.ts` via the same TypeScript transpile pattern as `scripts/i18n-tests.mjs`.

Tests:

1. Fixture matching one home category + H02 maps to `Catalog` with `presets[0].id === 'H02'`.
2. Empty `{ categories: [], presets: [] }` returns `null`.
3. Bundled `catalog.json` round-trip: build a fake Sanity payload from JSON (same field names as GROQ result) and assert `catalogFromSanity` equals the original categories/presets (ignore `source`).

- [ ] **Step 4: Run tests (they should fail until the mapper is complete)**

Run: `node scripts/catalog-sanity-tests.mjs`

Expected: fail, then after mapper: `N catalog-sanity checks passed`.

- [ ] **Step 5: Add `"test:catalog-sanity": "node scripts/catalog-sanity-tests.mjs"` to `package.json` scripts.**

---

### Task 3: Cache, provider, snapshot accessors

**Files:**
- Create: `src/features/catalog/cache.ts`
- Create: `src/features/catalog/CatalogProvider.tsx`
- Modify: `src/features/catalog/index.ts`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `getSanityClient`, `CATALOG_GROQ`, `catalogFromSanity`, bundled `catalog.json`
- Produces: `useCatalog(): Catalog`, `getCatalogSnapshot(): Catalog`, `refreshCatalog(): Promise<void>`

- [ ] **Step 1: Cache helper `src/features/catalog/cache.ts`**

Key: `kdo.catalogCache.v1`. Store `{ fetchedAt: string, catalog: Catalog }`. Read/write via AsyncStorage. Invalid JSON → `null`.

- [ ] **Step 2: Provider**

On mount:

1. Set snapshot to bundled `catalog.json`.
2. If cache parses, replace snapshot (so a previous Sanity fetch wins over a stale bundle).
3. If `getSanityClient()` is non-null, `client.fetch(CATALOG_GROQ)`, `catalogFromSanity`, on success write cache + snapshot.
4. On network/parse failure, keep current snapshot (bundle or cache). Never empty the library.

Module-level `currentCatalog` so `getPreset` / `hydrateRecurringTasks` can call `getCatalogSnapshot()` without hooks.

```ts
let currentCatalog: Catalog = bundled;

export function getCatalogSnapshot(): Catalog {
  return currentCatalog;
}
```

`useCatalog()` reads context and re-renders when snapshot changes.

- [ ] **Step 3: Change `src/features/catalog/index.ts`**

- Keep exporting bundled data as `bundledCatalog`.
- `getPreset(id)`, `getCategory(key)`, `findGroup(key)`, `groupLabel(key)` read `getCatalogSnapshot()` instead of the static import.
- Re-export `useCatalog`, `CatalogProvider`, `refreshCatalog`.

- [ ] **Step 4: Wrap in `src/app/_layout.tsx` inside `I18nProvider`, outside `AuthProvider`.** Catalog is not user-specific.

- [ ] **Step 5: Library screens**

Replace `import { catalog, getPreset, ...}` usage of the `catalog` binding with `const catalog = useCatalog()` in:

- `src/app/(app)/(tabs)/templates/catalog/index.tsx`
- `src/app/(app)/(tabs)/templates/catalog/group/[groupId].tsx`
- `src/app/(app)/(tabs)/templates/catalog/preset/[presetId].tsx`
- `src/app/(app)/(tabs)/templates/index.tsx` (libraryCount)
- `src/features/catalog/components.tsx` if it reads `catalog` (it currently takes props / `getCategory`)

`getPreset` can stay as a snapshot function because it will see the hydrated catalog after the provider runs.

- [ ] **Step 6: Typecheck + lint + existing catalog tests**

Run:

```
npx tsc --noEmit
npx expo lint
node scripts/catalog-tests.mjs
node scripts/catalog-sanity-tests.mjs
```

Expected: all pass. `catalog-tests.mjs` still validates bundled JSON vs markdown.

---

### Task 4: Local Studio schema

**Files:**
- Create: `studio/package.json`, `studio/sanity.config.ts`, `studio/sanity.cli.ts`
- Create: `studio/schemaTypes/catalogCategory.ts`
- Create: `studio/schemaTypes/catalogGroup.ts`
- Create: `studio/schemaTypes/catalogPreset.ts`
- Create: `studio/schemaTypes/index.ts`

Studio is a nested package so Expo Metro does not bundle it. Root `package.json` does not add `sanity` as an app dependency.

- [ ] **Step 1: Scaffold `studio/` with Sanity v3/v4 CLI defaults.**

`studio/sanity.cli.ts`:

```ts
import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: { projectId: 'qxq0r1rb', dataset: 'production' },
});
```

`studio/sanity.config.ts`: projectId `qxq0r1rb`, dataset `production`, schema types below, title `KitchDo Library`.

- [ ] **Step 2: Schema — `catalogCategory`**

Fields: `key` (string, `home` | `kitchen`), `label`, `icon`, `guidance` (optional text), `featured` (array of references to `catalogPreset`), `sortOrder` (number).

- [ ] **Step 3: Schema — `catalogGroup`**

Fields: `key`, `label`, `icon`, `category` (reference `catalogCategory`), `sortOrder`.

- [ ] **Step 4: Schema — `catalogPreset`**

Fields matching `CatalogPreset`:

- `stableId` (string, unique, e.g. `H02`) — this is the app `id`
- `title`, `cadence` (string), `frequency` (`daily` | `weekly` | `monthly`, optional)
- `category` ref, `group` ref
- `searchTerms` string[], `aliases` string[]
- `sections`: array of objects `{ title?: string, tasks: string[] }`
- `notes`: array of `{ text, links[]: { label, url } }`
- `sortOrder` number

Do not add `preview` config if deploying via MCP later (MCP rejects `preview`). Local Studio may include previews (`title`, `stableId`).

- [ ] **Step 5: User action — dataset public**

In [https://www.sanity.io/manage/project/qxq0r1rb](https://www.sanity.io/manage/project/qxq0r1rb) → Dataset `production` → **Public**. Confirm before import. Without this, the app client cannot read.

- [ ] **Step 6: Deploy schema**

From `studio/`: `npx sanity schema deploy` (or start Studio once so the schema is pushed). If CLI asks to log in, the user completes that in the terminal.

---

### Task 5: Import bundled catalog into Sanity

**Files:**
- Create: `scripts/import-catalog-to-sanity.mjs`

**Interfaces:**
- Consumes: `src/features/catalog/catalog.json`, env `SANITY_API_WRITE_TOKEN`, project `qxq0r1rb`, dataset `production`
- Produces: published documents with IDs `category.*`, `group.*`, `preset.*`

- [ ] **Step 1: Create a write token in Sanity manage (Editor or Deploy Studio). Put it only in local `.env` as `SANITY_API_WRITE_TOKEN`. Never `EXPO_PUBLIC_`.**

- [ ] **Step 2: Import script**

Use `@sanity/client` from the app’s `node_modules` (or `studio/node_modules`). Read `catalog.json`. For each category/group/preset, `client.createOrReplace` with those stable `_id`s so re-running is idempotent.

Order: categories → groups (with `category._ref`) → presets (with `category._ref` and `group._ref`) → patch categories’ `featured` refs.

Publish after create if the client writes drafts (`createOrReplace` on published IDs without `drafts.` prefix publishes directly).

- [ ] **Step 3: Dry-run flag `--dry-run` that prints counts (2 categories, N groups, 41 presets) without writing.**

- [ ] **Step 4: Run dry-run, then real import.**

```
node scripts/import-catalog-to-sanity.mjs --dry-run
node scripts/import-catalog-to-sanity.mjs
```

Expected: 41 presets; no `B01`.

- [ ] **Step 5: Verify with a GROQ fetch using the public client (no write token).** If this fails with 401/403, dataset is still private.

---

### Task 6: Docs and operator notes

**Files:**
- Modify: `docs/SETUP.md`

- [ ] **Step 1: Add a “Template library (Sanity)” section:**

- Project `qxq0r1rb`, dataset `production`, public
- Edit content: `cd studio && npx sanity dev` (localhost:3333)
- Re-import: `node scripts/import-catalog-to-sanity.mjs`
- App fallback: bundled `catalog.json` if offline or Sanity empty
- Markdown `docs/catalog/KitchDo_Home_and_Kitchen_Templates.md` is no longer the live source after import; keep it until we decide to stop `catalog:build`

---

## Follow-ups (not this plan)

- Localized catalog fields (`title`/`tasks` per UI locale).
- Dropping `catalog.json` / markdown as source.
- Hosted Studio (`*.sanity.studio`) and CORS for Expo web.
- Sanity MCP schema deploy (blocked until the MCP connection works in this environment).

## Self-review

- Spec coverage: link client, public reads, fallback, schema matching `Catalog`, import 41 presets, no secrets in git, English-only catalog, no Supabase changes.
- Placeholders: none; dataset-public is a user action in Task 4.
- Types: `Catalog`, `stableId` → `id`, `useCatalog()`, `getCatalogSnapshot()` used consistently.
