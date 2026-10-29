# KitchDo Part 1 — verification notes

## Works (implemented in code; exercise on device/simulator)

| Flow | Notes |
| --- | --- |
| Auth email/password + onboarding RPC | Wired to `complete_onboarding`; profile/kitchen loaded after session |
| Templates / categories / schedules | Stage D (parallel agent) — publish then Use now / schedule |
| Use now → manual run | `create_manual_run` with client mutation UUID + local cache/outbox |
| Today tab | `ensure_scheduled_occurrences` on focus/resume via SyncProvider; due + earlier unfinished |
| Run execution | Done / Not applicable / Blocked (note required for exceptions); optional done note; reopen → `pending`; resolve issue |
| History | Local-date list with All / Finished / Unfinished; outcome summary; detail = same snapshot screen |
| Offline outbox | SQLite FIFO; idempotent mutation ids; account-scoped clear on sign-out |
| Sync banner | Offline / Syncing / Changes waiting / Retry |
| Settings | Edit profile & kitchen (name/kind); reminders toggle + permission prompt; version; sign-out pending warning; `delete_my_account` |
| Local reminders | `expo-notifications`; occurrence_key → notification id map; reconcile/cancel helpers |
| Domain date/occurrence tests | `node scripts/domain-tests.mjs` |

## Not verified / blockers

| Item | Why |
| --- | --- |
| Physical iPhone notifications | Needs a device/dev build; simulator permissions differ |
| Force-quit offline completion round-trip | Needs manual device QA against live project |
| Multi-device revision conflicts | Expected-revision surface exists; full conflict UX not polished |
| Auth email templates / Apple signing | Dashboard / team setup left for morning review (`decisions.md`) |
| Reminder tap on physical device | Code path wired (`ReminderResponseBridge` + `openRunForOccurrence`); device delivery still unverified |
| Template edit while offline | Intentionally network-required; banner component available (`NetworkRequiredBanner`) |

## Suggested manual smoke

1. Sign up → onboard home kitchen.
2. Create template with 2+ items → publish → Use now → mark done / blocked with note.
3. Add schedule with reminder → enable reminders in Settings → confirm permission prompt.
4. Background app → reopen Today → confirm scheduled occurrence appears after materialization.
5. Toggle airplane mode → mark item → see Changes waiting → reconnect → Retry / auto flush.
6. Sign out with pending change → confirm warning.
