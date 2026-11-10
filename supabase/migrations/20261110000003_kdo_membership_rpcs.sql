-- Membership RPCs + owner-check replacements. Child rows still stamp kitchen creator.

-- ===========================================================================
-- Internal: append activity as a member
-- ===========================================================================
create or replace function public.kdo_append_activity(
  p_kitchen_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_context jsonb,
  p_reported_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_owner := private.kdo_require_member(p_kitchen_id);

  insert into public.kdo_activity_events (
    id, owner_user_id, kitchen_id, entity_type, entity_id, action, context, reported_at
  ) values (
    v_id, v_owner, p_kitchen_id, p_entity_type, p_entity_id, p_action,
    coalesce(p_context, '{}'::jsonb), coalesce(p_reported_at, timezone('utc', now()))
  );

  return v_id;
end;
$$;

create or replace function public.kdo_reconcile_run_progress(p_run_id uuid)
returns public.kdo_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_run public.kdo_runs;
  v_pending integer;
  v_total integer;
  v_new_state text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_run from public.kdo_runs r where r.id = p_run_id for update;
  if not found then
    raise exception 'run not found';
  end if;
  perform private.kdo_require_member(v_run.kitchen_id);

  select
    count(*) filter (where outcome = 'pending'),
    count(*)
  into v_pending, v_total
  from public.kdo_run_items
  where run_id = p_run_id;

  if v_run.state = 'cancelled' then
    return v_run;
  end if;

  if v_total = 0 then
    v_new_state := 'finished';
  elsif v_pending = v_total then
    v_new_state := 'not_started';
  elsif v_pending = 0 then
    v_new_state := 'finished';
  else
    v_new_state := 'in_progress';
  end if;

  update public.kdo_runs
  set
    state = v_new_state,
    completed_at = case when v_new_state = 'finished' then coalesce(completed_at, timezone('utc', now())) else null end,
    closed_at = case when v_new_state = 'finished' then coalesce(closed_at, timezone('utc', now())) else null end,
    revision = revision + 1,
    updated_at = timezone('utc', now())
  where id = p_run_id
  returning * into v_run;

  return v_run;
end;
$$;

-- ===========================================================================
-- complete_onboarding: first kitchen + admin membership
-- ===========================================================================
create or replace function public.complete_onboarding(
  p_display_name text,
  p_kitchen_name text,
  p_kitchen_kind text default 'home',
  p_kitchen_id uuid default null,
  p_locale text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.kdo_require_user_id();
  v_kitchen_id uuid;
  v_existing_kitchen public.kdo_kitchens;
  v_member_kitchen uuid;
begin
  if p_kitchen_kind is null or p_kitchen_kind not in ('home', 'business') then
    raise exception 'kitchen kind must be home or business';
  end if;

  insert into public.kdo_profiles (user_id, display_name, locale)
  values (v_uid, btrim(p_display_name), p_locale)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        locale = coalesce(excluded.locale, public.kdo_profiles.locale),
        updated_at = timezone('utc', now());

  select k.* into v_existing_kitchen
  from public.kdo_kitchens k
  where k.owner_user_id = v_uid
    and k.archived_at is null
  order by k.created_at
  limit 1;

  if found then
    update public.kdo_kitchens
    set
      name = btrim(p_kitchen_name),
      kind = p_kitchen_kind,
      revision = revision + 1,
      updated_at = timezone('utc', now())
    where id = v_existing_kitchen.id
    returning id into v_kitchen_id;
  else
    select m.kitchen_id into v_member_kitchen
    from public.kdo_kitchen_members m
    join public.kdo_kitchens k on k.id = m.kitchen_id
    where m.user_id = v_uid
      and k.archived_at is null
    order by m.joined_at
    limit 1;

    if found then
      return jsonb_build_object('user_id', v_uid, 'kitchen_id', v_member_kitchen);
    end if;

    v_kitchen_id := coalesce(p_kitchen_id, gen_random_uuid());
    insert into public.kdo_kitchens (id, owner_user_id, kind, name)
    values (v_kitchen_id, v_uid, p_kitchen_kind, btrim(p_kitchen_name));
  end if;

  insert into public.kdo_kitchen_members (
    kitchen_id, user_id, role, can_complete, can_edit_templates
  ) values (
    v_kitchen_id, v_uid, 'admin', true, true
  )
  on conflict (kitchen_id, user_id) do update
    set role = 'admin', can_complete = true, can_edit_templates = true;

  return jsonb_build_object(
    'user_id', v_uid,
    'kitchen_id', v_kitchen_id
  );
end;
$$;

-- ===========================================================================
-- New kitchens / invites / join / leave
-- ===========================================================================
create or replace function public.create_kitchen(
  p_name text,
  p_kind text,
  p_kitchen_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.kdo_require_user_id();
  v_kitchen_id uuid := coalesce(p_kitchen_id, gen_random_uuid());
begin
  if p_kind is null or p_kind not in ('home', 'business') then
    raise exception 'kitchen kind must be home or business';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'kitchen name is required';
  end if;

  insert into public.kdo_kitchens (id, owner_user_id, kind, name)
  values (v_kitchen_id, v_uid, p_kind, btrim(p_name));

  insert into public.kdo_kitchen_members (
    kitchen_id, user_id, role, can_complete, can_edit_templates
  ) values (
    v_kitchen_id, v_uid, 'admin', true, true
  );

  return jsonb_build_object('kitchen_id', v_kitchen_id);
end;
$$;

revoke all on function public.create_kitchen(text, text, uuid) from public, anon;
grant execute on function public.create_kitchen(text, text, uuid) to authenticated;

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

create or replace function public.revoke_kitchen_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.kdo_kitchen_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_invite from public.kdo_kitchen_invites where id = p_invite_id;
  if not found then raise exception 'invite not found'; end if;
  perform private.kdo_require_admin(v_invite.kitchen_id);

  update public.kdo_kitchen_invites
  set revoked_at = timezone('utc', now())
  where id = p_invite_id
    and revoked_at is null;

  return jsonb_build_object('invite_id', p_invite_id, 'revoked', true);
end;
$$;

revoke all on function public.revoke_kitchen_invite(uuid) from public, anon;
grant execute on function public.revoke_kitchen_invite(uuid) to authenticated;

create or replace function public.join_kitchen(
  p_code text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_invite public.kdo_kitchen_invites;
  v_profile public.kdo_profiles;
  v_kitchen public.kdo_kitchens;
  v_name text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Z]', '', 'g'));
  v_code := replace(replace(replace(v_code, 'I', '1'), 'L', '1'), 'O', '0');
  if v_code !~ '^[0-9A-HJKMNP-TV-Z]{8}$' then
    raise exception 'invalid join code';
  end if;

  select * into v_invite
  from public.kdo_kitchen_invites i
  where i.code = v_code
  for update;

  if not found then raise exception 'invalid join code'; end if;
  if v_invite.revoked_at is not null then raise exception 'this code has been revoked'; end if;
  if v_invite.expires_at <= timezone('utc', now()) then raise exception 'this code has expired'; end if;

  if exists (
    select 1 from public.kdo_kitchen_members m
    where m.kitchen_id = v_invite.kitchen_id and m.user_id = v_uid
  ) then
    -- already a member of this kitchen — return it so the client can switch.
    select * into v_kitchen from public.kdo_kitchens k where k.id = v_invite.kitchen_id;
    return jsonb_build_object(
      'kitchen_id', v_kitchen.id,
      'kitchen_name', v_kitchen.name,
      'kind', v_kitchen.kind,
      'already_member', true
    );
  end if;

  select * into v_profile from public.kdo_profiles p where p.user_id = v_uid;
  v_name := nullif(btrim(coalesce(p_display_name, '')), '');
  if not found then
    if v_name is null then
      raise exception 'display name required';
    end if;
    insert into public.kdo_profiles (user_id, display_name)
    values (v_uid, v_name);
  elsif v_name is not null then
    update public.kdo_profiles
    set display_name = v_name, updated_at = timezone('utc', now())
    where user_id = v_uid;
  end if;

  insert into public.kdo_kitchen_members (
    kitchen_id, user_id, role, can_complete, can_edit_templates
  ) values (
    v_invite.kitchen_id, v_uid, 'member',
    v_invite.can_complete, v_invite.can_edit_templates
  );

  select * into v_kitchen from public.kdo_kitchens k where k.id = v_invite.kitchen_id;

  return jsonb_build_object(
    'kitchen_id', v_kitchen.id,
    'kitchen_name', v_kitchen.name,
    'kind', v_kitchen.kind,
    'role', 'member',
    'can_complete', v_invite.can_complete,
    'can_edit_templates', v_invite.can_edit_templates
  );
end;
$$;

revoke all on function public.join_kitchen(text, text) from public, anon;
grant execute on function public.join_kitchen(text, text) to authenticated;

create or replace function public.leave_kitchen(p_kitchen_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.kdo_kitchen_members;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_member
  from public.kdo_kitchen_members m
  where m.kitchen_id = p_kitchen_id and m.user_id = v_uid;

  if not found then raise exception 'not a member of this kitchen'; end if;

  if v_member.role = 'admin'
     and private.kdo_admin_count(p_kitchen_id) = 1
     and private.kdo_member_count(p_kitchen_id) > 1 then
    raise exception 'last admin cannot leave while others remain';
  end if;

  delete from public.kdo_kitchen_members
  where kitchen_id = p_kitchen_id and user_id = v_uid;

  return jsonb_build_object('kitchen_id', p_kitchen_id, 'left', true);
end;
$$;

revoke all on function public.leave_kitchen(uuid) from public, anon;
grant execute on function public.leave_kitchen(uuid) to authenticated;

create or replace function public.remove_member(p_kitchen_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.kdo_kitchen_members;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  perform private.kdo_require_admin(p_kitchen_id);

  if p_user_id = v_uid then
    raise exception 'use leave_kitchen to leave';
  end if;

  select * into v_target
  from public.kdo_kitchen_members m
  where m.kitchen_id = p_kitchen_id and m.user_id = p_user_id;

  if not found then raise exception 'member not found'; end if;

  if v_target.role = 'admin'
     and private.kdo_admin_count(p_kitchen_id) = 1 then
    raise exception 'cannot remove the last admin';
  end if;

  delete from public.kdo_kitchen_members
  where kitchen_id = p_kitchen_id and user_id = p_user_id;

  return jsonb_build_object('kitchen_id', p_kitchen_id, 'removed_user_id', p_user_id);
end;
$$;

revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

create or replace function public.update_member_permissions(
  p_kitchen_id uuid,
  p_user_id uuid,
  p_can_complete boolean,
  p_can_edit_templates boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.kdo_kitchen_members;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  perform private.kdo_require_admin(p_kitchen_id);

  select * into v_target
  from public.kdo_kitchen_members m
  where m.kitchen_id = p_kitchen_id and m.user_id = p_user_id;

  if not found then raise exception 'member not found'; end if;
  if v_target.role = 'admin' then
    raise exception 'admin permissions cannot be reduced this way';
  end if;

  update public.kdo_kitchen_members
  set
    can_complete = coalesce(p_can_complete, can_complete),
    can_edit_templates = coalesce(p_can_edit_templates, can_edit_templates)
  where kitchen_id = p_kitchen_id and user_id = p_user_id;

  return jsonb_build_object(
    'kitchen_id', p_kitchen_id,
    'user_id', p_user_id,
    'can_complete', coalesce(p_can_complete, v_target.can_complete),
    'can_edit_templates', coalesce(p_can_edit_templates, v_target.can_edit_templates)
  );
end;
$$;

revoke all on function public.update_member_permissions(uuid, uuid, boolean, boolean) from public, anon;
grant execute on function public.update_member_permissions(uuid, uuid, boolean, boolean) to authenticated;
