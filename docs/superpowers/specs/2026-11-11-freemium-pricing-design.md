# Freemium pricing

**Date:** 2026-11-11  
**Status:** approved for implementation  
**App Store / Play billing receipts:** next pass. This version stores the kitchen plan and enforces caps. The in-app picker sets the plan so we can test; production must verify a store receipt before calling `set_kitchen_plan`.

## Goal

Personal kitchens stay free with a small list cap. Paying is per kitchen, for more lists and more people. No “contact us” in this version.

## Tiers (per kitchen)

The kitchen **owner** (creator / `owner_user_id`) pays. People who join with a code do not. One account can own a free home kitchen and a Pro work kitchen.

| | Free | Light | Pro |
| --- | --- | --- | --- |
| Month | 0 | 30 kr | 99 kr |
| Year | — | 300 kr (2 months free) | 990 kr |
| Lists | 5 | Unlimited | Unlimited |
| People | 1 | 2 | 6 |

List = any non-archived template on that kitchen (library adopt or homemade).  
Person = a row in `kdo_kitchen_members` for that kitchen.

## Caps

- **6th list on free:** cannot create, duplicate, or adopt until Light. Existing lists stay.
- **Invite on free:** paywall for Light.
- **3rd person on Light:** paywall for Pro.
- **7th person on Pro:** “This kitchen is full.” No higher plan.
- **Join with a code** when the kitchen is already at its people cap: join fails (same as invite).
- Already over a cap (grandfathered): keep what you have; cannot add more.
- **Downgrade:** refuse until people (and lists, if going to Free) fit the lower plan. Nobody is removed automatically.

## Out of scope

Store receipt verification, family sharing, per-seat add-ons, contact-us / 7+ teams, trials, refunds.