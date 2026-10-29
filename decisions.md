# KitchDo Part 1 — Decisions log

Prepared overnight for morning review. Secrets are never copied here.

## Status at handoff start

| Item | Decision / result |
| --- | --- |
| Supabase project | Reuse existing project `edckblrenbujjsdirnab` from `.env` (URL host). Do **not** create a new project. |
| `.env` shape | Normalized from raw 3-line paste → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only). Raw backup kept as `.env.env.raw-backup`. |
| Supabase MCP | Project `.cursor/mcp.json` + user `~/.cursor/mcp.json` → `https://mcp.supabase.com/mcp?project_ref=edckblrenbujjsdirnab`. Enabled + OAuth completed (`agent mcp login supabase`). |
| Supabase skills | Installed via `npx skills add supabase/agent-skills`: `.agents/skills/supabase`, `.agents/skills/supabase-postgres-best-practices`. |
| Design skills used | **UI/UX Pro Max** (`~/.cursor/skills/ui-ux-pro-max`), **frontend-design** (`~/.agents/skills/frontend-design`). |

---

## Product / scope decisions

1. **Fresh Expo TypeScript app** in this empty repo (no prior RN foundation found). Expo Router, iOS-first.
2. **Solo owner model only** (Part 1). No invitation/team UI.
3. **English copy** centralised under `src/i18n` for later localisation.
4. **One kitchen at onboarding**; schema still allows multiple owned kitchens later.
5. **Checkbox items only**; notes yes; photos/temps deferred.
6. **Local device timezone** auto-detected; no timezone picker.
7. **Template editing requires network** in V1; offline covers downloaded runs + outbox completions.
8. **Account deletion** deletes only `kdo_*` data for the caller, then Auth user; documented if Auth is shared with other apps (KitchFlow) after schema inspection.

---

## Design system (from both design skills)

**Direction:** Friendly kitchen companion × focused personal productivity — calm, tactile, list-first. Not corporate restaurant software. Not cream+terracotta “AI kitchen” cliché. Not purple SaaS.

| Token area | Choice | Why |
| --- | --- | --- |
| Product fit | Productivity Tool + Grocery/checklist cues (UI/UX Pro Max) | Checklist execution first; kitchen warmth second |
| Style | Soft flat + restrained micro-interactions (not Bauhaus hard-shadow; not electric-blue SaaS) | Readable under time pressure; modern personal app |
| Palette | Deep teal primary `#0F766E`, soft mint canvas `#F2FBF8`, charcoal ink `#14302C`, coral action `#E11D48` for urgency only, warm sand surface `#FFF8F1` for secondary panels | Teal focus + clear hierarchy from Pro Max productivity palette; coral replaces orange for stronger WCAG on white |
| Typography | Display: **Fraunces** (soft old-style, kitchen-human); Body/UI: **DM Sans**; Mono labels: **IBM Plex Mono** | Avoid Inter/Roboto/system defaults per frontend-design; Fraunces ≠ Playfair “editorial luxury” overuse |
| Surfaces | Soft 12–16px radii, hairline borders, almost-no cards in hero; compact checklist rows | Brief: compact practical rows, restrained rounded surfaces |
| Motion | 180–280ms fades/slides; spring presses; honor reduced motion | 2–3 intentional motions; Pro Max 150–300ms guidance |
| Logo | Text treatment **Kdo** (large rounded K + small “do”) until an approved vector asset is added | Asset missing in repo |

Respect system light/dark: light is default brand; dark uses inverted teal surfaces without neon glow.

---

## Technical stack decisions

| Choice | Value |
| --- | --- |
| Runtime | Expo SDK current stable (install-time), TypeScript strict |
| Nav | Expo Router — tabs: Today / Templates / History; Settings stack secondary |
| Backend client | `@supabase/supabase-js` + SecureStore session persistence |
| Local DB | `expo-sqlite` + versioned migrations + mutation outbox |
| Reminders | `expo-notifications` local only |
| Dates/TZ | `luxon` (IANA + DST rules centralised in `src/lib/dates`) |
| Forms | `zod` + controlled RN inputs |
| UUIDs | `expo-crypto` / `crypto.randomUUID` for offline-safe IDs |
| Package manager | npm (lockfile committed); do not introduce a second PM |
| Schema naming | Additive `public.kdo_*` tables; leave any KitchFlow objects untouched |
| Migrations | Versioned SQL under `supabase/migrations/`; apply via Supabase MCP `apply_migration` |

---

## Data / scheduling decisions

1. **Occurrence key (scheduled):** `{series_id}:{local_date}:{HH:mm}` — stable across retries/DST.
2. **Occurrence key (manual):** `manual:{uuid}` retained through outbox retries.
3. **DST:** nonexistent local start → next valid local instant; repeated wall time → earlier instant, one occurrence.
4. **Midnight:** run belongs to local start date, not due date.
5. **Publish:** creates immutable `kdo_template_revisions` row; runs pin `template_revision_id`.
6. **Schedule edits:** close old interval (`effective_until`), insert new row same `series_id`.
7. **Idempotency:** client mutation UUID → `kdo_mutation_receipts`; conflict on same id + different hash → reject.
8. **Offline:** FIFO outbox per user+kitchen; never flush after account switch without clearing.

---

## Auth / security decisions

1. Email/password via existing Supabase Auth project settings (inspect before changing).
2. Deep link scheme: `kitchdo://auth/callback` for reset/confirm.
3. RLS: every `kdo_*` table; owner = `auth.uid()`; composite FKs for kitchen ownership.
4. Sensitive ops as Postgres RPCs with explicit `auth.uid()` checks.
5. Service role key stays in `.env` only for agent/CLI; never in RN bundle.
6. If Auth users are shared with KitchFlow: `delete_my_account` removes `kdo_*` then Auth user only after documenting shared-identity risk.

---

## Deferred to Part 2 (explicit)

Invitations, shared kitchens, roles, assignments, handovers, photos, temperatures, Android release pipeline, payments, marketplace.

---

## Open / verify-in-morning

- [ ] Confirm MCP project URL matches dashboard expectation for `edckblrenbujjsdirnab`
- [ ] Confirm Auth email confirmation / reset templates in Supabase dashboard
- [ ] Drop approved Kdo logo into `assets/` if available
- [ ] Review visual tokens on a physical iPhone
- [ ] Confirm whether Auth is shared with KitchFlow before enabling hard account delete in production
- [ ] Sign iOS build / Apple team (not done overnight)

---

## Changelog of decisions during build

- **2026-10-27:** Confirmed project `edckblrenbujjsdirnab` via MCP `get_project_url`. Public schema empty; Auth present; no KitchFlow tables in this project. Safe to create additive `kdo_*` from scratch. Account deletion can remove Auth user without shared-app collision **in this project**.
- **2026-10-27:** Scaffolding fresh Expo TypeScript blank template in-repo (directory was non-empty; merged from temp create-expo-app).
- **2026-10-27 (Stage C):** Applied additive `public.kdo_*` migrations via Supabase MCP: `kdo_schema`, `kdo_rls`, `kdo_rpcs` (remote applied RPCs in parts after a no-op placeholder; local file remains `20261027000003_kdo_rpcs.sql`), then `kdo_security_grants`. 13 tables with RLS; section-9 RPCs live; generated `src/types/database.ts`. Advisors: no ERROR/CRITICAL; remaining WARN is intentional `authenticated` EXECUTE on SECURITY DEFINER public RPCs (anon/PUBLIC revoked). `delete_my_account` deletes caller `kdo_*` then Auth user (safe here: Auth not shared).
- **2026-10-27 (Stages E–G):** Client run execution + Today materialization (`ensure_scheduled_occurrences` on focus/resume), History from snapshots, expo-sqlite cache/outbox (FIFO, mutation UUIDs, account clear on switch), sync status UI, local reminders map (`occurrence_key` → notification id), Settings profile/kitchen/reminders/delete. Manual-run offline: outcomes blocked until `create_manual_run` flushes and local items are replaced with server IDs. Domain smoke tests: `node scripts/domain-tests.mjs`. See `docs/SETUP.md` + `docs/VERIFICATION.md`.
- **2026-10-27 (Stage D):** Wired `complete_onboarding` RPC; AuthProvider bootstraps from `kdo_profiles` + primary `kdo_kitchens`. Categories (CRUD/reorder + `archive_category`) and templates (list/builder + draft/publish/duplicate/archive RPCs) under Templates tab; schedule editor via `revise_schedule` / `pause_schedule`. Suggested category names are optional chips only.
- **2026-10-27 (follow-up):** Reminder tap cold-start/foreground routing via `ReminderResponseBridge` → `openRunForOccurrence` (ensure + cache lookup by `occurrence_key`).
- **2026-10-27 (alignment pass):** Applied UI/UX Pro Max layout rules — shared `ScreenHeader`/`IconButton`/`Chip`, empty states top-aligned to content edge (not mid-float), button/input vertical centering, tab bar safe-area padding.
