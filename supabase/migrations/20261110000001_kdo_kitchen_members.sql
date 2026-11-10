-- Kitchen membership: members, invites, private helpers, owner stamp, backfill.
-- Additive. Do not apply remotely until asked.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, postgres;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.kdo_kitchen_members (
  kitchen_id uuid not null references public.kdo_kitchens (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null
    constraint kdo_kitchen_members_role_check check (role in ('admin', 'member')),
  can_complete boolean not null default true,
  can_edit_templates boolean not null default false,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (kitchen_id, user_id),
  constraint kdo_kitchen_members_admin_flags_check check (
    role <> 'admin'
    or (can_complete and can_edit_templates)
  )
);

create index kdo_kitchen_members_user_id_idx
  on public.kdo_kitchen_members (user_id);

create index kdo_kitchen_members_kitchen_role_idx
  on public.kdo_kitchen_members (kitchen_id, role);

create table public.kdo_kitchen_invites (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kdo_kitchens (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  code text not null
    constraint kdo_kitchen_invites_code_format check (code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  can_complete boolean not null default true,
  can_edit_templates boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint kdo_kitchen_invites_code_key unique (code)
);

create index kdo_kitchen_invites_kitchen_active_idx
  on public.kdo_kitchen_invites (kitchen_id, expires_at)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Private helpers (SECURITY DEFINER, auth.uid() in body)
-- ---------------------------------------------------------------------------
create or replace function private.kdo_is_member(p_kitchen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kdo_kitchen_members m
    where m.kitchen_id = p_kitchen_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.kdo_is_admin(p_kitchen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kdo_kitchen_members m
    where m.kitchen_id = p_kitchen_id
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

create or replace function private.kdo_can_complete(p_kitchen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kdo_kitchen_members m
    where m.kitchen_id = p_kitchen_id
      and m.user_id = (select auth.uid())
      and (m.role = 'admin' or m.can_complete)
  );
$$;

create or replace function private.kdo_can_edit_templates(p_kitchen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kdo_kitchen_members m
    where m.kitchen_id = p_kitchen_id
      and m.user_id = (select auth.uid())
      and (m.role = 'admin' or m.can_edit_templates)
  );
$$;

create or replace function private.kdo_kitchen_owner_id(p_kitchen_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select k.owner_user_id
  from public.kdo_kitchens k
  where k.id = p_kitchen_id;
$$;

create or replace function private.kdo_require_member(p_kitchen_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  if not private.kdo_is_member(p_kitchen_id) then
    raise exception 'kitchen not found or not a member';
  end if;
  v_owner := private.kdo_kitchen_owner_id(p_kitchen_id);
  if v_owner is null then
    raise exception 'kitchen not found or not a member';
  end if;
  return v_owner;
end;
$$;

create or replace function private.kdo_require_complete(p_kitchen_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.kdo_require_member(p_kitchen_id);
  if not private.kdo_can_complete(p_kitchen_id) then
    raise exception 'not allowed to complete checklists in this kitchen';
  end if;
  return private.kdo_kitchen_owner_id(p_kitchen_id);
end;
$$;

create or replace function private.kdo_require_edit(p_kitchen_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.kdo_require_member(p_kitchen_id);
  if not private.kdo_can_edit_templates(p_kitchen_id) then
    raise exception 'not allowed to edit templates in this kitchen';
  end if;
  return private.kdo_kitchen_owner_id(p_kitchen_id);
end;
$$;

create or replace function private.kdo_require_admin(p_kitchen_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.kdo_require_member(p_kitchen_id);
  if not private.kdo_is_admin(p_kitchen_id) then
    raise exception 'not allowed to manage this kitchen';
  end if;
  return private.kdo_kitchen_owner_id(p_kitchen_id);
end;
$$;

create or replace function private.kdo_admin_count(p_kitchen_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.kdo_kitchen_members m
  where m.kitchen_id = p_kitchen_id
    and m.role = 'admin';
$$;

create or replace function private.kdo_member_count(p_kitchen_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.kdo_kitchen_members m
  where m.kitchen_id = p_kitchen_id;
$$;

create or replace function private.kdo_random_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  result text := '';
  i integer;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function private.kdo_reassign_kitchen_owner(p_kitchen_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.kdo_kitchens
    set owner_user_id = p_new_owner, revision = revision + 1, updated_at = timezone('utc', now())
    where id = p_kitchen_id;
  update public.kdo_categories set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_templates set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_template_sections set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_template_items set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_template_revisions set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_schedules set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_runs set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_run_items set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_issues set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
  update public.kdo_activity_events set owner_user_id = p_new_owner where kitchen_id = p_kitchen_id;
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname like 'kdo_%'
  loop
    execute format('revoke all on function private.%I(%s) from public, anon', fn.proname, fn.args);
    execute format(
      'grant execute on function private.%I(%s) to authenticated, postgres',
      fn.proname,
      fn.args
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Stamp child rows with the kitchen creator so composite FKs hold for members
-- ---------------------------------------------------------------------------
create or replace function public.kdo_stamp_kitchen_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.kitchen_id is null then
    return new;
  end if;
  select k.owner_user_id into v_owner
  from public.kdo_kitchens k
  where k.id = new.kitchen_id;
  if v_owner is null then
    raise exception 'kitchen not found';
  end if;
  new.owner_user_id := v_owner;
  return new;
end;
$$;

revoke all on function public.kdo_stamp_kitchen_owner() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'kdo_categories',
    'kdo_templates',
    'kdo_template_sections',
    'kdo_template_items',
    'kdo_template_revisions',
    'kdo_schedules',
    'kdo_runs',
    'kdo_run_items',
    'kdo_issues',
    'kdo_activity_events'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      t || '_stamp_owner',
      t
    );
    execute format(
      'create trigger %I before insert or update of kitchen_id, owner_user_id
       on public.%I for each row execute function public.kdo_stamp_kitchen_owner()',
      t || '_stamp_owner',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Backfill: every kitchen creator is an admin
-- ---------------------------------------------------------------------------
insert into public.kdo_kitchen_members (
  kitchen_id, user_id, role, can_complete, can_edit_templates
)
select k.id, k.owner_user_id, 'admin', true, true
from public.kdo_kitchens k
on conflict (kitchen_id, user_id) do nothing;
