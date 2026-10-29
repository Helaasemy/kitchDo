-- KitchDo Stage C: RLS policies + GRANTs for authenticated
-- Owner model: owner_user_id / user_id = (select auth.uid())
-- Immutable tables: SELECT only; mutations via RPCs

-- ---------------------------------------------------------------------------
-- Helper: assert authenticated caller (invoker-safe)
-- ---------------------------------------------------------------------------
create or replace function public.kdo_current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid();
$$;

revoke all on function public.kdo_current_user_id() from public;
grant execute on function public.kdo_current_user_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.kdo_profiles enable row level security;
alter table public.kdo_kitchens enable row level security;
alter table public.kdo_categories enable row level security;
alter table public.kdo_templates enable row level security;
alter table public.kdo_template_sections enable row level security;
alter table public.kdo_template_items enable row level security;
alter table public.kdo_template_revisions enable row level security;
alter table public.kdo_schedules enable row level security;
alter table public.kdo_runs enable row level security;
alter table public.kdo_run_items enable row level security;
alter table public.kdo_issues enable row level security;
alter table public.kdo_mutation_receipts enable row level security;
alter table public.kdo_activity_events enable row level security;

alter table public.kdo_profiles force row level security;
alter table public.kdo_kitchens force row level security;
alter table public.kdo_categories force row level security;
alter table public.kdo_templates force row level security;
alter table public.kdo_template_sections force row level security;
alter table public.kdo_template_items force row level security;
alter table public.kdo_template_revisions force row level security;
alter table public.kdo_schedules force row level security;
alter table public.kdo_runs force row level security;
alter table public.kdo_run_items force row level security;
alter table public.kdo_issues force row level security;
alter table public.kdo_mutation_receipts force row level security;
alter table public.kdo_activity_events force row level security;

-- ---------------------------------------------------------------------------
-- GRANTs (Data API exposure). anon gets nothing.
-- ---------------------------------------------------------------------------
revoke all on table public.kdo_profiles from anon, authenticated, public;
revoke all on table public.kdo_kitchens from anon, authenticated, public;
revoke all on table public.kdo_categories from anon, authenticated, public;
revoke all on table public.kdo_templates from anon, authenticated, public;
revoke all on table public.kdo_template_sections from anon, authenticated, public;
revoke all on table public.kdo_template_items from anon, authenticated, public;
revoke all on table public.kdo_template_revisions from anon, authenticated, public;
revoke all on table public.kdo_schedules from anon, authenticated, public;
revoke all on table public.kdo_runs from anon, authenticated, public;
revoke all on table public.kdo_run_items from anon, authenticated, public;
revoke all on table public.kdo_issues from anon, authenticated, public;
revoke all on table public.kdo_mutation_receipts from anon, authenticated, public;
revoke all on table public.kdo_activity_events from anon, authenticated, public;

-- Mutable owner tables: select/insert/update (no hard delete; soft-archive via RPC/update)
grant select, insert, update on table public.kdo_profiles to authenticated;
grant select, insert, update on table public.kdo_kitchens to authenticated;
grant select, insert, update on table public.kdo_categories to authenticated;
grant select, insert, update on table public.kdo_templates to authenticated;
grant select, insert, update, delete on table public.kdo_template_sections to authenticated;
grant select, insert, update, delete on table public.kdo_template_items to authenticated;

-- Runs / issues: read + limited update (writes primarily via RPC)
grant select, update on table public.kdo_runs to authenticated;
grant select, update on table public.kdo_run_items to authenticated;
grant select, update on table public.kdo_issues to authenticated;

-- Immutable / RPC-only writes: SELECT only for authenticated
grant select on table public.kdo_template_revisions to authenticated;
grant select on table public.kdo_schedules to authenticated;
grant select on table public.kdo_mutation_receipts to authenticated;
grant select on table public.kdo_activity_events to authenticated;

-- ---------------------------------------------------------------------------
-- Policies: kdo_profiles
-- ---------------------------------------------------------------------------
create policy kdo_profiles_select_own
  on public.kdo_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy kdo_profiles_insert_own
  on public.kdo_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy kdo_profiles_update_own
  on public.kdo_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Policies: kdo_kitchens
-- ---------------------------------------------------------------------------
create policy kdo_kitchens_select_own
  on public.kdo_kitchens for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_kitchens_insert_own
  on public.kdo_kitchens for insert to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_kitchens_update_own
  on public.kdo_kitchens for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

-- ---------------------------------------------------------------------------
-- Policies: kdo_categories
-- ---------------------------------------------------------------------------
create policy kdo_categories_select_own
  on public.kdo_categories for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_categories_insert_own
  on public.kdo_categories for insert to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_categories_update_own
  on public.kdo_categories for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

-- ---------------------------------------------------------------------------
-- Policies: kdo_templates
-- ---------------------------------------------------------------------------
create policy kdo_templates_select_own
  on public.kdo_templates for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_templates_insert_own
  on public.kdo_templates for insert to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_templates_update_own
  on public.kdo_templates for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

-- ---------------------------------------------------------------------------
-- Policies: kdo_template_sections / items (draft editing)
-- ---------------------------------------------------------------------------
create policy kdo_template_sections_select_own
  on public.kdo_template_sections for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_template_sections_insert_own
  on public.kdo_template_sections for insert to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_template_sections_update_own
  on public.kdo_template_sections for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_template_sections_delete_own
  on public.kdo_template_sections for delete to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_template_items_select_own
  on public.kdo_template_items for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_template_items_insert_own
  on public.kdo_template_items for insert to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_template_items_update_own
  on public.kdo_template_items for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_template_items_delete_own
  on public.kdo_template_items for delete to authenticated
  using ((select auth.uid()) = owner_user_id);

-- ---------------------------------------------------------------------------
-- Immutable: revisions, schedules, receipts, activity — SELECT only
-- ---------------------------------------------------------------------------
create policy kdo_template_revisions_select_own
  on public.kdo_template_revisions for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_schedules_select_own
  on public.kdo_schedules for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_mutation_receipts_select_own
  on public.kdo_mutation_receipts for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_activity_events_select_own
  on public.kdo_activity_events for select to authenticated
  using ((select auth.uid()) = owner_user_id);

-- ---------------------------------------------------------------------------
-- Runs / run items / issues — owner select + update (insert via RPC)
-- ---------------------------------------------------------------------------
create policy kdo_runs_select_own
  on public.kdo_runs for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_runs_update_own
  on public.kdo_runs for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_run_items_select_own
  on public.kdo_run_items for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_run_items_update_own
  on public.kdo_run_items for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_issues_select_own
  on public.kdo_issues for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy kdo_issues_update_own
  on public.kdo_issues for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);
