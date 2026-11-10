-- Membership RLS: members can read kitchen data; writes follow capability helpers.

alter table public.kdo_kitchen_members enable row level security;
alter table public.kdo_kitchen_members force row level security;
alter table public.kdo_kitchen_invites enable row level security;
alter table public.kdo_kitchen_invites force row level security;

revoke all on table public.kdo_kitchen_members from anon, authenticated, public;
revoke all on table public.kdo_kitchen_invites from anon, authenticated, public;
grant select, insert on table public.kdo_kitchen_members to authenticated;
grant select on table public.kdo_kitchen_invites to authenticated;

-- Drop owner-only policies so membership policies can replace them.
drop policy if exists kdo_kitchens_select_own on public.kdo_kitchens;
drop policy if exists kdo_kitchens_insert_own on public.kdo_kitchens;
drop policy if exists kdo_kitchens_update_own on public.kdo_kitchens;
drop policy if exists kdo_categories_select_own on public.kdo_categories;
drop policy if exists kdo_categories_insert_own on public.kdo_categories;
drop policy if exists kdo_categories_update_own on public.kdo_categories;
drop policy if exists kdo_templates_select_own on public.kdo_templates;
drop policy if exists kdo_templates_insert_own on public.kdo_templates;
drop policy if exists kdo_templates_update_own on public.kdo_templates;
drop policy if exists kdo_template_sections_select_own on public.kdo_template_sections;
drop policy if exists kdo_template_sections_insert_own on public.kdo_template_sections;
drop policy if exists kdo_template_sections_update_own on public.kdo_template_sections;
drop policy if exists kdo_template_sections_delete_own on public.kdo_template_sections;
drop policy if exists kdo_template_items_select_own on public.kdo_template_items;
drop policy if exists kdo_template_items_insert_own on public.kdo_template_items;
drop policy if exists kdo_template_items_update_own on public.kdo_template_items;
drop policy if exists kdo_template_items_delete_own on public.kdo_template_items;
drop policy if exists kdo_template_revisions_select_own on public.kdo_template_revisions;
drop policy if exists kdo_schedules_select_own on public.kdo_schedules;
drop policy if exists kdo_runs_select_own on public.kdo_runs;
drop policy if exists kdo_runs_update_own on public.kdo_runs;
drop policy if exists kdo_run_items_select_own on public.kdo_run_items;
drop policy if exists kdo_run_items_update_own on public.kdo_run_items;
drop policy if exists kdo_issues_select_own on public.kdo_issues;
drop policy if exists kdo_issues_update_own on public.kdo_issues;
drop policy if exists kdo_activity_events_select_own on public.kdo_activity_events;

-- Profiles: self, plus display names of people who share a kitchen.
drop policy if exists kdo_profiles_select_own on public.kdo_profiles;
create policy kdo_profiles_select_own
  on public.kdo_profiles for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.kdo_kitchen_members mine
      join public.kdo_kitchen_members theirs
        on theirs.kitchen_id = mine.kitchen_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = kdo_profiles.user_id
    )
  );

create policy kdo_kitchen_members_select
  on public.kdo_kitchen_members for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

-- Creator may insert their own admin row (complete_onboarding / create_kitchen).
-- Joining via code still goes through the DEFINER join_kitchen RPC.
create policy kdo_kitchen_members_insert_creator
  on public.kdo_kitchen_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'admin'
    and can_complete
    and can_edit_templates
    and (select private.kdo_kitchen_owner_id(kitchen_id)) = (select auth.uid())
  );

create policy kdo_kitchen_invites_select_admin
  on public.kdo_kitchen_invites for select to authenticated
  using ((select private.kdo_is_admin(kitchen_id)));

-- Kitchens
create policy kdo_kitchens_select_member
  on public.kdo_kitchens for select to authenticated
  using ((select private.kdo_is_member(id)));

create policy kdo_kitchens_insert_own
  on public.kdo_kitchens for insert to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy kdo_kitchens_update_admin
  on public.kdo_kitchens for update to authenticated
  using ((select private.kdo_is_admin(id)))
  with check ((select private.kdo_is_admin(id)));

-- Categories / templates / sections / items: members read; editors write
create policy kdo_categories_select_member
  on public.kdo_categories for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_categories_insert_edit
  on public.kdo_categories for insert to authenticated
  with check ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_categories_update_edit
  on public.kdo_categories for update to authenticated
  using ((select private.kdo_can_edit_templates(kitchen_id)))
  with check ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_templates_select_member
  on public.kdo_templates for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_templates_insert_edit
  on public.kdo_templates for insert to authenticated
  with check ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_templates_update_edit
  on public.kdo_templates for update to authenticated
  using ((select private.kdo_can_edit_templates(kitchen_id)))
  with check ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_template_sections_select_member
  on public.kdo_template_sections for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_template_sections_insert_edit
  on public.kdo_template_sections for insert to authenticated
  with check ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_template_sections_update_edit
  on public.kdo_template_sections for update to authenticated
  using ((select private.kdo_can_edit_templates(kitchen_id)))
  with check ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_template_sections_delete_edit
  on public.kdo_template_sections for delete to authenticated
  using ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_template_items_select_member
  on public.kdo_template_items for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_template_items_insert_edit
  on public.kdo_template_items for insert to authenticated
  with check ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_template_items_update_edit
  on public.kdo_template_items for update to authenticated
  using ((select private.kdo_can_edit_templates(kitchen_id)))
  with check ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_template_items_delete_edit
  on public.kdo_template_items for delete to authenticated
  using ((select private.kdo_can_edit_templates(kitchen_id)));

create policy kdo_template_revisions_select_member
  on public.kdo_template_revisions for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_schedules_select_member
  on public.kdo_schedules for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_runs_select_member
  on public.kdo_runs for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_runs_update_complete
  on public.kdo_runs for update to authenticated
  using ((select private.kdo_can_complete(kitchen_id)))
  with check ((select private.kdo_can_complete(kitchen_id)));

create policy kdo_run_items_select_member
  on public.kdo_run_items for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_run_items_update_complete
  on public.kdo_run_items for update to authenticated
  using ((select private.kdo_can_complete(kitchen_id)))
  with check ((select private.kdo_can_complete(kitchen_id)));

create policy kdo_issues_select_member
  on public.kdo_issues for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));

create policy kdo_issues_update_complete
  on public.kdo_issues for update to authenticated
  using ((select private.kdo_can_complete(kitchen_id)))
  with check ((select private.kdo_can_complete(kitchen_id)));

create policy kdo_activity_events_select_member
  on public.kdo_activity_events for select to authenticated
  using ((select private.kdo_is_member(kitchen_id)));
