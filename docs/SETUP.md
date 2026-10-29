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
