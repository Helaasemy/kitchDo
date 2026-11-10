# Kitchen membership design

**Date:** 2026-11-10  
**Status:** approved for implementation  
**Payments:** out of scope. No seat cap.

## Goal

More than one signed-in person can share a kitchen: tick the same checklists, optionally edit templates, and (admins) invite or remove people. One account can belong to several kitchens (home and a market) and switch between them.

## Product rules

- **Admin** can do everything in that kitchen: complete checklists, edit templates/schedules, invite, revoke codes, change another member’s two flags, remove members, leave only if another admin remains.
- **Member** permissions are set on the invite (and can be changed later by an admin):
  - Complete checklists — default on
  - Edit templates and schedules — default off
- Join is a **short code**, not a web link in email. The same code is copied, shared, put in a mail body, and shown as a QR that encodes `kitchdo://join/<code>`.
- Codes are reusable until they expire (7 days) or an admin revokes them. Several codes can be active (different permission sets).
- After sign-up, onboarding is **create a kitchen** or **I have a code**. Redeeming a code as the first kitchen skips creating one. Onboarding is complete when the user has a profile and at least one membership.
- Join and invite need a network. Camera QR scan needs a development build.

## Current constraint

Part 1 is solo-owner. Every `kdo_*` row and RLS policy keys off `owner_user_id = auth.uid()`. Sync pulls the same way. Auth takes `listOwnedKitchens()[0]`. Settings already has a disabled Invite screen.

`owner_user_id` on kitchen rows stays the **creator** (billing hook later). Access is membership.

## Data model

### `kdo_kitchen_members`

- `kitchen_id` → `kdo_kitchens(id)` on delete cascade
- `user_id` → `auth.users(id)` on delete cascade
- unique `(kitchen_id, user_id)`
- `role` `admin` | `member`
- `can_complete` boolean
- `can_edit_templates` boolean
- `joined_at` timestamptz

Admin rows store both flags true. RPCs treat `role = admin` as full access including invite/remove, regardless of flags.

Indexes: `(user_id)`, `(kitchen_id, role)`.

### `kdo_kitchen_invites`

- `id` uuid pk
- `kitchen_id` → kitchens
- `created_by` → auth.users
- `code` text unique, 8 Crockford characters (`0-9 A-H J-K M-N P-R T-V W-X Y-Z`)
- `can_complete` / `can_edit_templates`
- `expires_at` (created + 7 days)
- `revoked_at` nullable
- `created_at`

Active invite = `revoked_at is null` and `expires_at > now()`.

### Backfill

One admin membership per existing `kdo_kitchens.owner_user_id`.

### Helpers (private schema, SECURITY DEFINER)

Always check `(select auth.uid())` inside the body. `EXECUTE` revoked from `PUBLIC`, `anon`, `authenticated`. RLS policies call them via `(select private.fn(kitchen_id))`.

- `kdo_is_member(kitchen_id)`
- `kdo_is_admin(kitchen_id)`
- `kdo_can_complete(kitchen_id)` — admin or `can_complete`
- `kdo_can_edit_templates(kitchen_id)` — admin or `can_edit_templates`
- `kdo_kitchen_owner_id(kitchen_id)` — creator uuid for stamping child rows

A trigger on kitchen-owned tables stamps `owner_user_id` from the kitchen so member inserts satisfy composite FKs.

### Last admin

Cannot leave or be removed if they are the only admin. Account delete is blocked if the caller is last admin of a kitchen that still has other people. If the caller owns a kitchen that has another admin, reassign `owner_user_id` on that kitchen and its child rows to another admin, then delete the account.

## RPCs

Existing owner checks become membership checks. Child rows still write the kitchen creator as `owner_user_id`. `recorded_by` stays the acting user.

New:

- `create_kitchen_invite(kitchen_id, can_complete, can_edit_templates)` → code
- `revoke_kitchen_invite(invite_id)`
- `join_kitchen(code, display_name?)` — upserts profile if needed, inserts member from the invite flags, returns kitchen
- `create_kitchen(name, kind, kitchen_id?)` — extra kitchen; caller becomes admin
- `update_member_permissions(kitchen_id, user_id, can_complete, can_edit_templates)` — cannot demote last admin this way; admins keep role
- `remove_member(kitchen_id, user_id)`
- `leave_kitchen(kitchen_id)`
- `list_my_kitchens()` optional: client can select members ⋈ kitchens via RLS

`complete_onboarding` still creates the first kitchen and must insert the admin membership.

Do not apply these migrations to the live Supabase project until the product owner says so.

## App

### Auth

`AuthProvider` lists memberships, not only owned kitchens. Persist last-used `kitchenId` in the existing onboarding draft. Switching kitchen does not wipe other kitchens in SQLite (`user_id` + `kitchen_id` already). Expose `isAdmin`, `canComplete`, `canEditTemplates`, `switchKitchen`, `joinKitchen`, `createKitchen`.

Deep link `kitchdo://join/<code>`: if signed in, redeem (or send to join UI); if logged out, stash the code and apply after login. If the user still needs a display name, onboarding collects it then redeems.

### Invite screen

Wire `src/app/(app)/invite.tsx`. Drop coming soon. Two toggles, generate code, copy/share, QR, mailto with the code in the body. Member list with Admin vs flags. Admin can change flags or remove. Non-admins can see members and leave (if not last admin).

### Join

Type code or scan QR (`expo-camera`). Invalid / expired / revoked / already a member surface as errors.

### Switcher

Kitchen name on Today and Settings opens a list of memberships, plus create kitchen and join with code.

### UI gates

- Complete only: Today + History; template tab is read-only (no add/edit/schedule/catalog adopt); no invite management.
- Edit on: templates and schedules.
- Admin: invite/remove.

## Sync

`src/lib/sync/engine.ts` pulls by `kitchen_id` under membership RLS. Stop filtering `owner_user_id = me` on kitchen data. Outbox stays `(user_id, kitchen_id)` for the signed-in user. Cancel-run fallback updates must not require the local user to be the kitchen creator.

## Errors

| Case | Behaviour |
| --- | --- |
| Unknown / expired / revoked code | Join fails with a short message |
| Already a member | Join fails; switch to that kitchen if possible |
| Last admin leave/remove | Blocked |
| Delete account while last admin with others | Blocked |
| Offline join/invite | Network required |
| Camera denied | Type the code instead |
| Edit without flag | RPC + UI both refuse |

## Tests

Pure helpers: parse/format join codes (dashes, I/L/O normalisation, deep-link payload), effective permissions (admin vs flags), onboarding complete = profile + membership.

RPC/domain: redeem valid; reject expired/revoked; already a member; member cannot edit templates without the flag; last admin cannot leave; join completes onboarding without creating a kitchen.

## Out of scope

Payments, seat limits, named roles (owner/manager/worker), per-occurrence assignments, handovers, photos.
