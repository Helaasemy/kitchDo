-- Per-kitchen plans + hard list/people caps.
-- set_kitchen_plan is admin-only until store receipts land; do not treat it as a purchase.

alter table public.kdo_kitchens
  add column if not exists plan text not null default 'free',
  add column if not exists plan_interval text,
  add column if not exists plan_updated_at timestamptz;

alter table public.kdo_kitchens
  drop constraint if exists kdo_kitchens_plan_ck;
alter table public.kdo_kitchens
  add constraint kdo_kitchens_plan_ck
  check (plan in ('free', 'light', 'pro'));

alter table public.kdo_kitchens
  drop constraint if exists kdo_kitchens_plan_interval_ck;
alter table public.kdo_kitchens
  add constraint kdo_kitchens_plan_interval_ck
  check (
    (plan = 'free' and plan_interval is null)
    or (plan in ('light', 'pro') and plan_interval in ('monthly', 'yearly'))
  );

-- Admins may rename a kitchen; they must not flip plan columns from the client.
revoke update on table public.kdo_kitchens from authenticated;
grant update (
  name,
  kind,
  archived_at,
  revision,
  updated_at
) on table public.kdo_kitchens to authenticated;

create or replace function private.kdo_require_list_slot(p_kitchen_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_cap integer;
  v_n integer;
begin
  select k.plan into v_plan
  from public.kdo_kitchens k
  where k.id = p_kitchen_id
  for update;
  if not found then raise exception 'kitchen not found'; end if;

  v_cap := case v_plan when 'free' then 5 else null end;
  if v_cap is null then return; end if;

  select count(*)::integer into v_n
  from public.kdo_templates t
  where t.kitchen_id = p_kitchen_id
    and t.state is distinct from 'archived';

  if v_n >= v_cap then
    raise exception 'list limit reached';
  end if;
end;
$$;

create or replace function private.kdo_require_people_slot(p_kitchen_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_cap integer;
  v_n integer;
begin
  select k.plan into v_plan
  from public.kdo_kitchens k
  where k.id = p_kitchen_id
  for update;
  if not found then raise exception 'kitchen not found'; end if;

  v_cap := case v_plan
    when 'free' then 1
    when 'light' then 2
    else 6
  end;

  select count(*)::integer into v_n
  from public.kdo_kitchen_members m
  where m.kitchen_id = p_kitchen_id;

  if v_n >= v_cap then
    if v_plan = 'pro' then
      raise exception 'kitchen is full';
    end if;
    raise exception 'people limit reached';
  end if;
end;
$$;

revoke all on function private.kdo_require_list_slot(uuid) from public, anon, authenticated;
revoke all on function private.kdo_require_people_slot(uuid) from public, anon, authenticated;

create or replace function private.kdo_templates_guard_list_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.state is distinct from 'archived' then
      perform private.kdo_require_list_slot(new.kitchen_id);
    end if;
    return new;
  end if;

  if old.state = 'archived' and new.state is distinct from 'archived' then
    perform private.kdo_require_list_slot(new.kitchen_id);
  end if;
  return new;
end;
$$;

drop trigger if exists kdo_templates_list_slot on public.kdo_templates;
create trigger kdo_templates_list_slot
  before insert or update of state on public.kdo_templates
  for each row execute function private.kdo_templates_guard_list_slot();

create or replace function private.kdo_members_guard_people_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.kdo_require_people_slot(new.kitchen_id);
  return new;
end;
$$;

drop trigger if exists kdo_members_people_slot on public.kdo_kitchen_members;
create trigger kdo_members_people_slot
  before insert on public.kdo_kitchen_members
  for each row execute function private.kdo_members_guard_people_slot();

create or replace function public.set_kitchen_plan(
  p_kitchen_id uuid,
  p_plan text,
  p_interval text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_interval text;
  v_people integer;
  v_lists integer;
  v_people_cap integer;
  v_list_cap integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform private.kdo_require_admin(p_kitchen_id);

  if p_plan is null or p_plan not in ('free', 'light', 'pro') then
    raise exception 'invalid plan';
  end if;
  v_plan := p_plan;

  if v_plan = 'free' then
    v_interval := null;
  else
    if p_interval is null or p_interval not in ('monthly', 'yearly') then
      raise exception 'invalid interval';
    end if;
    v_interval := p_interval;
  end if;

  select count(*)::integer into v_people
  from public.kdo_kitchen_members m
  where m.kitchen_id = p_kitchen_id;

  select count(*)::integer into v_lists
  from public.kdo_templates t
  where t.kitchen_id = p_kitchen_id
    and t.state is distinct from 'archived';

  v_people_cap := case v_plan
    when 'free' then 1
    when 'light' then 2
    else 6
  end;
  v_list_cap := case v_plan when 'free' then 5 else null end;

  if v_people > v_people_cap then
    raise exception 'plan too small';
  end if;
  if v_list_cap is not null and v_lists > v_list_cap then
    raise exception 'plan too small';
  end if;

  update public.kdo_kitchens
  set
    plan = v_plan,
    plan_interval = v_interval,
    plan_updated_at = timezone('utc', now()),
    revision = revision + 1,
    updated_at = timezone('utc', now())
  where id = p_kitchen_id;

  return jsonb_build_object('plan', v_plan, 'interval', v_interval);
end;
$$;

revoke all on function public.set_kitchen_plan(uuid, text, text) from public, anon;
grant execute on function public.set_kitchen_plan(uuid, text, text) to authenticated;

create or replace function public.create_kitchen_invite(
  p_kitchen_id uuid,
  p_can_complete boolean default true,
  p_can_edit_templates boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_expires timestamptz := timezone('utc', now()) + interval '7 days';
  i integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  perform private.kdo_require_admin(p_kitchen_id);
  perform private.kdo_require_people_slot(p_kitchen_id);

  for i in 1..8 loop
    v_code := private.kdo_random_join_code();
    begin
      insert into public.kdo_kitchen_invites (
        kitchen_id, created_by, code, can_complete, can_edit_templates, expires_at
      ) values (
        p_kitchen_id, v_uid, v_code, coalesce(p_can_complete, true), coalesce(p_can_edit_templates, false), v_expires
      )
      returning id into v_id;
      exit;
    exception when unique_violation then
      if i = 8 then raise exception 'could not allocate join code'; end if;
    end;
  end loop;

  return jsonb_build_object(
    'invite_id', v_id,
    'code', v_code,
    'expires_at', v_expires,
    'can_complete', coalesce(p_can_complete, true),
    'can_edit_templates', coalesce(p_can_edit_templates, false)
  );
end;
$$;

revoke all on function public.create_kitchen_invite(uuid, boolean, boolean) from public, anon;
grant execute on function public.create_kitchen_invite(uuid, boolean, boolean) to authenticated;
