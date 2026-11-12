-- Two-level assignment: list default on kdo_templates, per-task override on items.
-- Additive. Do not rewrite owner_user_id FKs.

alter table public.kdo_templates
  add column if not exists assignee_user_id uuid;

alter table public.kdo_template_items
  add column if not exists assignee_user_id uuid,
  add column if not exists assignee_mode text not null default 'inherit';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kdo_templates_assignee_member_fkey'
      and conrelid = 'public.kdo_templates'::regclass
  ) then
    alter table public.kdo_templates
      add constraint kdo_templates_assignee_member_fkey
      foreign key (kitchen_id, assignee_user_id)
      references public.kdo_kitchen_members (kitchen_id, user_id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kdo_template_items_assignee_member_fkey'
      and conrelid = 'public.kdo_template_items'::regclass
  ) then
    alter table public.kdo_template_items
      add constraint kdo_template_items_assignee_member_fkey
      foreign key (kitchen_id, assignee_user_id)
      references public.kdo_kitchen_members (kitchen_id, user_id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kdo_template_items_assignee_mode_check'
      and conrelid = 'public.kdo_template_items'::regclass
  ) then
    alter table public.kdo_template_items
      add constraint kdo_template_items_assignee_mode_check
      check (assignee_mode in ('inherit', 'explicit'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kdo_template_items_assignee_inherit_null_check'
      and conrelid = 'public.kdo_template_items'::regclass
  ) then
    alter table public.kdo_template_items
      add constraint kdo_template_items_assignee_inherit_null_check
      check (assignee_mode <> 'inherit' or assignee_user_id is null);
  end if;
end $$;

create index if not exists kdo_templates_assignee_idx
  on public.kdo_templates (kitchen_id, assignee_user_id)
  where assignee_user_id is not null;

create index if not exists kdo_template_items_assignee_idx
  on public.kdo_template_items (kitchen_id, assignee_user_id)
  where assignee_user_id is not null;

create or replace function private.kdo_require_member_id(
  p_kitchen_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return null;
  end if;
  if not exists (
    select 1
    from public.kdo_kitchen_members m
    where m.kitchen_id = p_kitchen_id
      and m.user_id = p_user_id
  ) then
    raise exception 'assignee must be a kitchen member';
  end if;
  return p_user_id;
end;
$$;

revoke all on function private.kdo_require_member_id(uuid, uuid) from public, anon, authenticated;
