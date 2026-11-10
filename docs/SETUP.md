# KitchDo setup

## Prerequisites

- Node.js 22 (`nvm use 22`)
- npm (lockfile committed — do not introduce a second package manager)
- Expo Go or a development build for iOS
- Supabase project already linked via `.env`

## Environment

Copy `.env.example` → `.env` if needed. Required public keys:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is for agent/CLI only — never ship it in the app bundle.

Public Sanity keys (template library):

- `EXPO_PUBLIC_SANITY_PROJECT_ID` (`qxq0r1rb`)
- `EXPO_PUBLIC_SANITY_DATASET` (`production`)
- `EXPO_PUBLIC_SANITY_API_VERSION` (`2025-02-19`)

`SANITY_API_WRITE_TOKEN` is CLI/import only — never `EXPO_PUBLIC_`, never commit it. Dataset `production` must be **public** so the app can read without a token.

## Install and run

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22
cd /Users/helaasemy/Documents/projects/kitchDo
npm install
npx expo start
```

Deep link scheme: `kitchdo://` (password reset / auth callback).

## Local SQLite

On first launch the app opens `kdo_local_v1.db` and applies versioned migrations under `src/lib/storage/migrations.ts` (cached revisions/runs/items/issues, outbox, notification map, sync metadata). Data is scoped by `user_id` (+ kitchen) and cleared on sign-out / account switch.

## Domain tests

```bash
nvm use 22
node scripts/domain-tests.mjs
```

## Typecheck

```bash
nvm use 22
npx tsc --noEmit
```

## Template library (Sanity)

Project `qxq0r1rb`, dataset `production` (public). The app fetches the catalog for the active UI language, saves it on device, and does not fetch again until the language changes. `src/features/catalog/catalog.json` is the import seed for Studio, not the runtime source.

Edit content locally:

```bash
cd studio
npm install
npx sanity dev
```

Studio runs at http://localhost:3333. Re-seed from the bundled catalog (idempotent):

```bash
node scripts/import-catalog-to-sanity.mjs --dry-run
node scripts/import-catalog-to-sanity.mjs
```

Markdown `docs/catalog/KitchDo_Home_and_Kitchen_Templates.md` plus `npm run catalog:build` still generate the import seed. They are not what the app reads at runtime.

English is the source language on every translatable field (`localeString` / `localeText`). Other app locales (FR, ES, PT, DE, IT, ID, TR, ZH, JA, KO, AR) are optional in Studio under **Translations**. The app asks Sanity for the active locale and falls back to English. Frequency lives on each **section**; the template only shows a single daily/weekly/monthly value when every section agrees.
