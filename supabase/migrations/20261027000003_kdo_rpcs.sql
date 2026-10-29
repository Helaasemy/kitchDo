-- KitchDo Stage C: RPCs (section 9)
-- Prefer SECURITY INVOKER; DEFINER only when writing immutable rows / auth.users.
-- DEFINER: auth.uid() check, fixed search_path, schema-qualified, revoke public, grant authenticated.

-- ---------------------------------------------------------------------------
-- Weekday uniqueness (CHECK cannot use subqueries)
-- ---------------------------------------------------------------------------
create or replace function public.kdo_schedules_validate_weekdays()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(distinct w) from unnest(new.weekdays) as w
  ) <> cardinality(new.weekdays) then
    raise exception 'kdo_schedules weekdays must be unique';
  end if;
  return new;
end;
$$;

create trigger kdo_schedules_validate_weekdays
  before insert or update on public.kdo_schedules
  for each row execute function public.kdo_schedules_validate_weekdays();

-- ---------------------------------------------------------------------------
-- Internal helpers (DEFINER, not granted to clients)
-- ---------------------------------------------------------------------------
create or replace function public.kdo_require_user_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  return v_uid;
end;
$$;

revoke all on function public.kdo_require_user_id() from public, anon;
grant execute on function public.kdo_require_user_id() to authenticated;

create or replace function public.kdo_request_hash(p_payload jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');
$$;

revoke all on function public.kdo_request_hash(jsonb) from public, anon;
grant execute on function public.kdo_request_hash(jsonb) to authenticated;

-- Idempotent mutation gate. Returns prior result if same hash; raises on conflict.
-- Inserts nothing; caller inserts receipt after success via kdo_store_mutation_receipt.
create or replace function public.kdo_begin_mutation(
  p_mutation_id uuid,
  p_operation text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_existing public.kdo_mutation_receipts%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_mutation_id is null then
    raise exception 'mutation_id required';
  end if;

  v_hash := public.kdo_request_hash(p_payload);

  select * into v_existing
  from public.kdo_mutation_receipts r
  where r.owner_user_id = v_uid and r.id = p_mutation_id;

  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'mutation idempotency conflict for %', p_mutation_id;
    end if;
    return jsonb_build_object(
      'replay', true,
      'result', v_existing.result
    );
  end if;

  return jsonb_build_object(
    'replay', false,
    'request_hash', v_hash,
    'operation', p_operation
  );
end;
$$;

revoke all on function public.kdo_begin_mutation(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.kdo_store_mutation_receipt(
  p_mutation_id uuid,
  p_operation text,
  p_request_hash text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.kdo_mutation_receipts (id, owner_user_id, operation, request_hash, result)
  values (p_mutation_id, v_uid, p_operation, p_request_hash, coalesce(p_result, '{}'::jsonb));
exception
  when unique_violation then
    -- concurrent retry: verify hash via begin_mutation semantics on next call
    null;
end;
$$;

revoke all on function public.kdo_store_mutation_receipt(uuid, text, text, jsonb) from public, anon, authenticated;

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
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.kdo_kitchens k
    where k.id = p_kitchen_id and k.owner_user_id = v_uid
  ) then
    raise exception 'kitchen not found or not owned';
  end if;

  insert into public.kdo_activity_events (
    id, owner_user_id, kitchen_id, entity_type, entity_id, action, context, reported_at
  ) values (
    v_id, v_uid, p_kitchen_id, p_entity_type, p_entity_id, p_action,
    coalesce(p_context, '{}'::jsonb), coalesce(p_reported_at, timezone('utc', now()))
  );

  return v_id;
end;
$$;

revoke all on function public.kdo_append_activity(uuid, text, uuid, text, jsonb, timestamptz) from public, anon, authenticated;

create or replace function public.kdo_build_template_definition(
  p_template public.kdo_templates
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_category_name text;
  v_sections jsonb;
  v_items jsonb;
begin
  if p_template.category_id is not null then
    select c.name into v_category_name
    from public.kdo_categories c
    where c.id = p_template.category_id
      and c.kitchen_id = p_template.kitchen_id
      and c.owner_user_id = p_template.owner_user_id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'sort_order', s.sort_order
    ) order by s.sort_order, s.id
  ), '[]'::jsonb)
  into v_sections
  from public.kdo_template_sections s
  where s.template_id = p_template.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'section_id', i.section_id,
      'title', i.title,
      'instructions', i.instructions,
      'response_type', i.response_type,
      'sort_order', i.sort_order
    ) order by i.sort_order, i.id
  ), '[]'::jsonb)
  into v_items
  from public.kdo_template_items i
  where i.template_id = p_template.id;

  if jsonb_array_length(v_items) < 1 then
    raise exception 'template must have at least one item to publish';
  end if;

  return jsonb_build_object(
    'title', p_template.title,
    'description', p_template.description,
    'category_id', p_template.category_id,
    'category_name', v_category_name,
    'sections', v_sections,
    'items', v_items
  );
end;
$$;

revoke all on function public.kdo_build_template_definition(public.kdo_templates) from public, anon, authenticated;

create or replace function public.kdo_materialize_run_items(
  p_run_id uuid,
  p_kitchen_id uuid,
  p_owner_user_id uuid,
  p_definition jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_section jsonb;
  v_section_title text;
  v_section_order integer;
  v_sort integer := 0;
begin
  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_definition->'items', '[]'::jsonb))
    order by (value->>'sort_order')::integer nulls last, value->>'id'
  loop
    v_section_title := null;
    v_section_order := null;

    if v_item ? 'section_id' and v_item->>'section_id' is not null then
      select s.value->>'title', (s.value->>'sort_order')::integer
      into v_section_title, v_section_order
      from jsonb_array_elements(coalesce(p_definition->'sections', '[]'::jsonb)) as s(value)
      where s.value->>'id' = v_item->>'section_id'
      limit 1;
    end if;

    insert into public.kdo_run_items (
      run_id, kitchen_id, owner_user_id,
      source_item_id, source_section_id,
      section_title_snapshot, section_order_snapshot,
      title_snapshot, instructions_snapshot, response_type_snapshot,
      sort_order, outcome
    ) values (
      p_run_id, p_kitchen_id, p_owner_user_id,
      (v_item->>'id')::uuid,
      nullif(v_item->>'section_id', '')::uuid,
      v_section_title, v_section_order,
      v_item->>'title',
      v_item->>'instructions',
      coalesce(v_item->>'response_type', 'checkbox'),
      coalesce((v_item->>'sort_order')::integer, v_sort),
      'pending'
    );
    v_sort := v_sort + 1;
  end loop;
end;
$$;

revoke all on function public.kdo_materialize_run_items(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

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

  select * into v_run from public.kdo_runs r where r.id = p_run_id and r.owner_user_id = v_uid for update;
  if not found then
    raise exception 'run not found';
  end if;

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

revoke all on function public.kdo_reconcile_run_progress(uuid) from public, anon, authenticated;

-- ===========================================================================
-- 1. complete_onboarding
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
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.kdo_require_user_id();
  v_kitchen_id uuid;
  v_existing_kitchen public.kdo_kitchens;
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

  select * into v_existing_kitchen
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
    v_kitchen_id := coalesce(p_kitchen_id, gen_random_uuid());
    insert into public.kdo_kitchens (id, owner_user_id, kind, name)
    values (v_kitchen_id, v_uid, p_kitchen_kind, btrim(p_kitchen_name));
  end if;

  return jsonb_build_object(
    'user_id', v_uid,
    'kitchen_id', v_kitchen_id
  );
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, uuid, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, uuid, text) to authenticated;

-- ===========================================================================
-- 2. save_template_draft
-- ===========================================================================
create or replace function public.save_template_draft(
  p_mutation_id uuid,
  p_template_id uuid,
  p_kitchen_id uuid,
  p_expected_revision bigint,
  p_title text,
  p_description text default null,
  p_category_id uuid default null,
  p_sections jsonb default '[]'::jsonb,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_template public.kdo_templates;
  v_section jsonb;
  v_item jsonb;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'template_id', p_template_id,
    'kitchen_id', p_kitchen_id,
    'expected_revision', p_expected_revision,
    'title', p_title,
    'description', p_description,
    'category_id', p_category_id,
    'sections', coalesce(p_sections, '[]'::jsonb),
    'items', coalesce(p_items, '[]'::jsonb)
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'save_template_draft', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  if not exists (
    select 1 from public.kdo_kitchens k
    where k.id = p_kitchen_id and k.owner_user_id = v_uid and k.archived_at is null
  ) then
    raise exception 'kitchen not found or not owned';
  end if;

  select * into v_template
  from public.kdo_templates t
  where t.id = p_template_id and t.owner_user_id = v_uid
  for update;

  if not found then
    insert into public.kdo_templates (
      id, kitchen_id, owner_user_id, category_id, title, description, state, revision
    ) values (
      p_template_id, p_kitchen_id, v_uid, p_category_id, btrim(p_title), p_description, 'draft', 1
    )
    returning * into v_template;
  else
    if v_template.kitchen_id <> p_kitchen_id then
      raise exception 'kitchen mismatch';
    end if;
    if v_template.revision <> p_expected_revision then
      raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_template.revision;
    end if;
    if v_template.state = 'archived' then
      raise exception 'cannot edit archived template';
    end if;

    update public.kdo_templates
    set
      title = btrim(p_title),
      description = p_description,
      category_id = p_category_id,
      revision = revision + 1,
      updated_at = timezone('utc', now())
    where id = p_template_id
    returning * into v_template;
  end if;

  delete from public.kdo_template_items where template_id = p_template_id and owner_user_id = v_uid;
  delete from public.kdo_template_sections where template_id = p_template_id and owner_user_id = v_uid;

  for v_section in
    select value from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb))
  loop
    insert into public.kdo_template_sections (
      id, template_id, kitchen_id, owner_user_id, title, sort_order
    ) values (
      coalesce(nullif(v_section->>'id', '')::uuid, gen_random_uuid()),
      p_template_id, p_kitchen_id, v_uid,
      btrim(v_section->>'title'),
      coalesce((v_section->>'sort_order')::integer, 0)
    );
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if nullif(v_item->>'section_id', '') is not null
       and not exists (
         select 1 from public.kdo_template_sections s
         where s.id = (v_item->>'section_id')::uuid and s.template_id = p_template_id
       ) then
      raise exception 'item section_id must belong to template';
    end if;

    insert into public.kdo_template_items (
      id, template_id, kitchen_id, owner_user_id, section_id,
      title, instructions, response_type, sort_order
    ) values (
      coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
      p_template_id, p_kitchen_id, v_uid,
      nullif(v_item->>'section_id', '')::uuid,
      btrim(v_item->>'title'),
      v_item->>'instructions',
      'checkbox',
      coalesce((v_item->>'sort_order')::integer, 0)
    );
  end loop;

  v_result := jsonb_build_object(
    'template_id', v_template.id,
    'revision', v_template.revision
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'save_template_draft', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    p_kitchen_id, 'template', p_template_id, 'save_draft',
    jsonb_build_object('revision', v_template.revision)
  );

  return v_result;
end;
$$;

revoke all on function public.save_template_draft(uuid, uuid, uuid, bigint, text, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_template_draft(uuid, uuid, uuid, bigint, text, text, uuid, jsonb, jsonb) to authenticated;

-- ===========================================================================
-- 3. publish_template
-- ===========================================================================
create or replace function public.publish_template(
  p_mutation_id uuid,
  p_template_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_template public.kdo_templates;
  v_definition jsonb;
  v_version integer;
  v_revision_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'template_id', p_template_id,
    'expected_revision', p_expected_revision
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'publish_template', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_template
  from public.kdo_templates t
  where t.id = p_template_id and t.owner_user_id = v_uid
  for update;

  if not found then raise exception 'template not found'; end if;
  if v_template.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_template.revision;
  end if;
  if v_template.state = 'archived' then
    raise exception 'cannot publish archived template';
  end if;

  v_definition := public.kdo_build_template_definition(v_template);
  v_version := coalesce(v_template.published_revision, 0) + 1;

  insert into public.kdo_template_revisions (
    id, template_id, kitchen_id, owner_user_id, version, definition
  ) values (
    v_revision_id, v_template.id, v_template.kitchen_id, v_uid, v_version, v_definition
  );

  update public.kdo_templates
  set
    state = 'active',
    published_revision = v_version,
    revision = revision + 1,
    updated_at = timezone('utc', now())
  where id = p_template_id
  returning * into v_template;

  v_result := jsonb_build_object(
    'template_id', v_template.id,
    'revision', v_template.revision,
    'published_revision', v_version,
    'template_revision_id', v_revision_id
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'publish_template', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_template.kitchen_id, 'template', p_template_id, 'publish',
    jsonb_build_object('version', v_version, 'template_revision_id', v_revision_id)
  );

  return v_result;
end;
$$;

revoke all on function public.publish_template(uuid, uuid, bigint) from public, anon;
grant execute on function public.publish_template(uuid, uuid, bigint) to authenticated;

-- ===========================================================================
-- 4. duplicate_template
-- ===========================================================================
create or replace function public.duplicate_template(
  p_mutation_id uuid,
  p_template_id uuid,
  p_new_template_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_src public.kdo_templates;
  v_new_id uuid;
  v_section record;
  v_item record;
  v_section_map jsonb := '{}'::jsonb;
  v_new_section_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_new_id := coalesce(p_new_template_id, gen_random_uuid());
  v_payload := jsonb_build_object(
    'template_id', p_template_id,
    'new_template_id', v_new_id
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'duplicate_template', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_src
  from public.kdo_templates t
  where t.id = p_template_id and t.owner_user_id = v_uid;

  if not found then raise exception 'template not found'; end if;

  insert into public.kdo_templates (
    id, kitchen_id, owner_user_id, category_id, title, description, state, published_revision, revision
  ) values (
    v_new_id, v_src.kitchen_id, v_uid, v_src.category_id,
    left(v_src.title || ' (copy)', 200),
    v_src.description,
    'draft',
    null,
    1
  );

  for v_section in
    select * from public.kdo_template_sections s
    where s.template_id = p_template_id
    order by s.sort_order, s.id
  loop
    v_new_section_id := gen_random_uuid();
    v_section_map := v_section_map || jsonb_build_object(v_section.id::text, v_new_section_id::text);
    insert into public.kdo_template_sections (
      id, template_id, kitchen_id, owner_user_id, title, sort_order
    ) values (
      v_new_section_id, v_new_id, v_src.kitchen_id, v_uid, v_section.title, v_section.sort_order
    );
  end loop;

  for v_item in
    select * from public.kdo_template_items i
    where i.template_id = p_template_id
    order by i.sort_order, i.id
  loop
    insert into public.kdo_template_items (
      id, template_id, kitchen_id, owner_user_id, section_id,
      title, instructions, response_type, sort_order
    ) values (
      gen_random_uuid(), v_new_id, v_src.kitchen_id, v_uid,
      case
        when v_item.section_id is null then null
        else (v_section_map ->> v_item.section_id::text)::uuid
      end,
      v_item.title, v_item.instructions, v_item.response_type, v_item.sort_order
    );
  end loop;

  v_result := jsonb_build_object(
    'template_id', v_new_id,
    'source_template_id', p_template_id,
    'revision', 1
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'duplicate_template', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_src.kitchen_id, 'template', v_new_id, 'duplicate',
    jsonb_build_object('source_template_id', p_template_id)
  );

  return v_result;
end;
$$;

revoke all on function public.duplicate_template(uuid, uuid, uuid) from public, anon;
grant execute on function public.duplicate_template(uuid, uuid, uuid) to authenticated;

-- ===========================================================================
-- 5. revise_schedule / pause_schedule
-- ===========================================================================
create or replace function public.revise_schedule(
  p_mutation_id uuid,
  p_template_id uuid,
  p_series_id uuid,
  p_weekdays smallint[],
  p_local_start_time time,
  p_due_after_minutes integer,
  p_effective_from timestamptz,
  p_reminder_enabled boolean default false,
  p_reminder_lead_minutes integer default 0,
  p_new_schedule_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_template public.kdo_templates;
  v_schedule_id uuid;
  v_series_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_series_id := coalesce(p_series_id, gen_random_uuid());
  v_schedule_id := coalesce(p_new_schedule_id, gen_random_uuid());

  v_payload := jsonb_build_object(
    'template_id', p_template_id,
    'series_id', v_series_id,
    'weekdays', to_jsonb(p_weekdays),
    'local_start_time', p_local_start_time::text,
    'due_after_minutes', p_due_after_minutes,
    'effective_from', p_effective_from,
    'reminder_enabled', p_reminder_enabled,
    'reminder_lead_minutes', p_reminder_lead_minutes,
    'new_schedule_id', v_schedule_id
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'revise_schedule', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_template
  from public.kdo_templates t
  where t.id = p_template_id and t.owner_user_id = v_uid;

  if not found then raise exception 'template not found'; end if;
  if v_template.state = 'archived' then raise exception 'cannot schedule archived template'; end if;
  if v_template.published_revision is null then raise exception 'template must be published'; end if;

  update public.kdo_schedules s
  set effective_until = p_effective_from
  where s.series_id = v_series_id
    and s.owner_user_id = v_uid
    and s.effective_until is null
    and s.effective_from < p_effective_from;

  insert into public.kdo_schedules (
    id, series_id, template_id, kitchen_id, owner_user_id,
    weekdays, local_start_time, due_after_minutes,
    effective_from, effective_until,
    reminder_enabled, reminder_lead_minutes
  ) values (
    v_schedule_id, v_series_id, p_template_id, v_template.kitchen_id, v_uid,
    p_weekdays, p_local_start_time, p_due_after_minutes,
    p_effective_from, null,
    coalesce(p_reminder_enabled, false), coalesce(p_reminder_lead_minutes, 0)
  );

  v_result := jsonb_build_object(
    'schedule_id', v_schedule_id,
    'series_id', v_series_id,
    'template_id', p_template_id
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'revise_schedule', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_template.kitchen_id, 'schedule', v_schedule_id, 'revise',
    jsonb_build_object('series_id', v_series_id)
  );

  return v_result;
end;
$$;

revoke all on function public.revise_schedule(uuid, uuid, uuid, smallint[], time, integer, timestamptz, boolean, integer, uuid) from public, anon;
grant execute on function public.revise_schedule(uuid, uuid, uuid, smallint[], time, integer, timestamptz, boolean, integer, uuid) to authenticated;

create or replace function public.pause_schedule(
  p_mutation_id uuid,
  p_series_id uuid,
  p_effective_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_until timestamptz;
  v_schedule public.kdo_schedules;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_until := coalesce(p_effective_until, timezone('utc', now()));
  v_payload := jsonb_build_object(
    'series_id', p_series_id,
    'effective_until', v_until
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'pause_schedule', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_schedule
  from public.kdo_schedules s
  where s.series_id = p_series_id
    and s.owner_user_id = v_uid
    and s.effective_until is null
  order by s.effective_from desc
  limit 1
  for update;

  if not found then
    raise exception 'active schedule series not found';
  end if;

  if v_until <= v_schedule.effective_from then
    raise exception 'effective_until must be after effective_from';
  end if;

  update public.kdo_schedules
  set effective_until = v_until
  where id = v_schedule.id;

  v_result := jsonb_build_object(
    'schedule_id', v_schedule.id,
    'series_id', p_series_id,
    'effective_until', v_until
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'pause_schedule', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_schedule.kitchen_id, 'schedule', v_schedule.id, 'pause',
    jsonb_build_object('series_id', p_series_id, 'effective_until', v_until)
  );

  return v_result;
end;
$$;

revoke all on function public.pause_schedule(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.pause_schedule(uuid, uuid, timestamptz) to authenticated;

-- ===========================================================================
-- 6. create_manual_run
-- ===========================================================================
create or replace function public.create_manual_run(
  p_mutation_id uuid,
  p_template_revision_id uuid,
  p_run_id uuid,
  p_occurrence_key text,
  p_local_date date,
  p_timezone text,
  p_scheduled_for timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_rev public.kdo_template_revisions;
  v_scheduled_for timestamptz;
  v_existing public.kdo_runs;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'template_revision_id', p_template_revision_id,
    'run_id', p_run_id,
    'occurrence_key', p_occurrence_key,
    'local_date', p_local_date,
    'timezone', p_timezone,
    'scheduled_for', p_scheduled_for
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'create_manual_run', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  if p_occurrence_key is null or p_occurrence_key not like 'manual:%' then
    raise exception 'manual occurrence_key must start with manual:';
  end if;

  select * into v_rev
  from public.kdo_template_revisions r
  where r.id = p_template_revision_id and r.owner_user_id = v_uid;

  if not found then raise exception 'template revision not found'; end if;

  select * into v_existing
  from public.kdo_runs r
  where r.kitchen_id = v_rev.kitchen_id and r.occurrence_key = p_occurrence_key;

  if found then
    v_result := jsonb_build_object('run_id', v_existing.id, 'replayed_occurrence', true);
    perform public.kdo_store_mutation_receipt(
      p_mutation_id, 'create_manual_run', v_gate->>'request_hash', v_result
    );
    return v_result;
  end if;

  v_scheduled_for := coalesce(p_scheduled_for, timezone('utc', now()));

  insert into public.kdo_runs (
    id, kitchen_id, owner_user_id, template_id, template_revision_id,
    schedule_id, source, occurrence_key,
    title_snapshot, category_id_snapshot, category_name_snapshot,
    local_date, timezone_snapshot, scheduled_for, due_at, state
  ) values (
    p_run_id, v_rev.kitchen_id, v_uid, v_rev.template_id, v_rev.id,
    null, 'manual', p_occurrence_key,
    v_rev.definition->>'title',
    nullif(v_rev.definition->>'category_id', '')::uuid,
    v_rev.definition->>'category_name',
    p_local_date, p_timezone, v_scheduled_for, null, 'not_started'
  );

  perform public.kdo_materialize_run_items(p_run_id, v_rev.kitchen_id, v_uid, v_rev.definition);

  v_result := jsonb_build_object('run_id', p_run_id, 'replayed_occurrence', false);

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'create_manual_run', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_rev.kitchen_id, 'run', p_run_id, 'create_manual',
    jsonb_build_object('occurrence_key', p_occurrence_key)
  );

  return v_result;
end;
$$;

revoke all on function public.create_manual_run(uuid, uuid, uuid, text, date, text, timestamptz) from public, anon;
grant execute on function public.create_manual_run(uuid, uuid, uuid, text, date, text, timestamptz) to authenticated;

-- ===========================================================================
-- 7. ensure_scheduled_occurrences
-- ===========================================================================
create or replace function public.ensure_scheduled_occurrences(
  p_kitchen_id uuid,
  p_from_date date,
  p_to_date date,
  p_timezone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day date;
  v_sched record;
  v_iso_dow integer;
  v_local_ts timestamp;
  v_scheduled_for timestamptz;
  v_due_at timestamptz;
  v_occurrence_key text;
  v_time_text text;
  v_rev public.kdo_template_revisions;
  v_run_id uuid;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then
    raise exception 'invalid date range';
  end if;
  if p_to_date > p_from_date + 62 then
    raise exception 'date range too large (max 62 days)';
  end if;

  if not exists (
    select 1 from public.kdo_kitchens k
    where k.id = p_kitchen_id and k.owner_user_id = v_uid
  ) then
    raise exception 'kitchen not found or not owned';
  end if;

  v_day := p_from_date;
  while v_day <= p_to_date loop
    -- ISO DOW: Monday=1 .. Sunday=7
    v_iso_dow := extract(isodow from v_day)::integer;

    for v_sched in
      select s.*, t.published_revision
      from public.kdo_schedules s
      join public.kdo_templates t
        on t.id = s.template_id and t.owner_user_id = s.owner_user_id
      where s.kitchen_id = p_kitchen_id
        and s.owner_user_id = v_uid
        and t.state = 'active'
        and t.published_revision is not null
        and v_iso_dow = any (s.weekdays)
        and s.effective_from <= ((v_day + s.local_start_time) at time zone p_timezone)
        and (s.effective_until is null
             or s.effective_until > ((v_day + s.local_start_time) at time zone p_timezone))
    loop
      v_local_ts := v_day + v_sched.local_start_time;
      -- Local wall time → timestamptz. Nonexistent DST times resolve to next valid instant in PG.
      v_scheduled_for := v_local_ts at time zone p_timezone;
      v_due_at := v_scheduled_for + make_interval(mins => v_sched.due_after_minutes);
      v_time_text := to_char(v_sched.local_start_time, 'HH24:MI');
      v_occurrence_key := v_sched.series_id::text || ':' || v_day::text || ':' || v_time_text;

      if exists (
        select 1 from public.kdo_runs r
        where r.kitchen_id = p_kitchen_id and r.occurrence_key = v_occurrence_key
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      select * into v_rev
      from public.kdo_template_revisions r
      where r.template_id = v_sched.template_id
        and r.owner_user_id = v_uid
        and r.published_at <= v_scheduled_for
      order by r.version desc
      limit 1;

      if not found then
        select * into v_rev
        from public.kdo_template_revisions r
        where r.template_id = v_sched.template_id
          and r.owner_user_id = v_uid
        order by r.version asc
        limit 1;
      end if;

      if not found then
        continue;
      end if;

      v_run_id := gen_random_uuid();
      insert into public.kdo_runs (
        id, kitchen_id, owner_user_id, template_id, template_revision_id,
        schedule_id, source, occurrence_key,
        title_snapshot, category_id_snapshot, category_name_snapshot,
        local_date, timezone_snapshot, scheduled_for, due_at, state
      ) values (
        v_run_id, p_kitchen_id, v_uid, v_sched.template_id, v_rev.id,
        v_sched.id, 'scheduled', v_occurrence_key,
        v_rev.definition->>'title',
        nullif(v_rev.definition->>'category_id', '')::uuid,
        v_rev.definition->>'category_name',
        v_day, p_timezone, v_scheduled_for, v_due_at, 'not_started'
      );

      perform public.kdo_materialize_run_items(v_run_id, p_kitchen_id, v_uid, v_rev.definition);
      v_created := v_created + 1;
    end loop;

    v_day := v_day + 1;
  end loop;

  return jsonb_build_object(
    'kitchen_id', p_kitchen_id,
    'created', v_created,
    'skipped', v_skipped,
    'from_date', p_from_date,
    'to_date', p_to_date
  );
end;
$$;

revoke all on function public.ensure_scheduled_occurrences(uuid, date, date, text) from public, anon;
grant execute on function public.ensure_scheduled_occurrences(uuid, date, date, text) to authenticated;

-- ===========================================================================
-- 8. apply_item_outcome
-- ===========================================================================
create or replace function public.apply_item_outcome(
  p_mutation_id uuid,
  p_run_item_id uuid,
  p_expected_revision bigint,
  p_outcome text,
  p_note text default null,
  p_recorded_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_item public.kdo_run_items;
  v_before text;
  v_issue_id uuid;
  v_run public.kdo_runs;
  v_result jsonb;
  v_recorded_at timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'run_item_id', p_run_item_id,
    'expected_revision', p_expected_revision,
    'outcome', p_outcome,
    'note', p_note,
    'recorded_at', p_recorded_at
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'apply_item_outcome', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  if p_outcome not in ('pending', 'done', 'not_applicable', 'blocked') then
    raise exception 'invalid outcome';
  end if;
  if p_outcome in ('not_applicable', 'blocked')
     and (p_note is null or char_length(btrim(p_note)) = 0) then
    raise exception 'note required for %', p_outcome;
  end if;

  select * into v_item
  from public.kdo_run_items i
  where i.id = p_run_item_id and i.owner_user_id = v_uid
  for update;

  if not found then raise exception 'run item not found'; end if;
  if v_item.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_item.revision;
  end if;

  v_before := v_item.outcome;
  v_recorded_at := coalesce(p_recorded_at, timezone('utc', now()));

  if p_outcome = 'pending' then
    update public.kdo_run_items
    set
      outcome = 'pending',
      note = null,
      recorded_by = null,
      recorded_at = null,
      received_at = null,
      revision = revision + 1,
      updated_at = timezone('utc', now())
    where id = p_run_item_id
    returning * into v_item;
  else
    update public.kdo_run_items
    set
      outcome = p_outcome,
      note = case when p_outcome in ('not_applicable', 'blocked') then btrim(p_note) else p_note end,
      recorded_by = v_uid,
      recorded_at = v_recorded_at,
      received_at = timezone('utc', now()),
      revision = revision + 1,
      updated_at = timezone('utc', now())
    where id = p_run_item_id
    returning * into v_item;
  end if;

  if p_outcome = 'blocked' then
    select i.id into v_issue_id
    from public.kdo_issues i
    where i.run_item_id = v_item.id
    for update;

    if found then
      update public.kdo_issues
      set
        description = btrim(p_note),
        state = 'open',
        resolved_at = null,
        resolution_note = null,
        reported_at = v_recorded_at,
        revision = revision + 1,
        updated_at = timezone('utc', now())
      where id = v_issue_id;
    else
      insert into public.kdo_issues (
        kitchen_id, owner_user_id, run_id, run_item_id, description, state, reported_at
      ) values (
        v_item.kitchen_id, v_uid, v_item.run_id, v_item.id, btrim(p_note), 'open', v_recorded_at
      )
      returning id into v_issue_id;
    end if;
  end if;

  v_run := public.kdo_reconcile_run_progress(v_item.run_id);

  perform public.kdo_append_activity(
    v_item.kitchen_id, 'run_item', v_item.id, 'apply_outcome',
    jsonb_build_object(
      'before', v_before,
      'after', p_outcome,
      'run_id', v_item.run_id,
      'issue_id', v_issue_id
    ),
    v_recorded_at
  );

  v_result := jsonb_build_object(
    'run_item_id', v_item.id,
    'revision', v_item.revision,
    'outcome', v_item.outcome,
    'run_id', v_run.id,
    'run_state', v_run.state,
    'run_revision', v_run.revision,
    'issue_id', v_issue_id
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'apply_item_outcome', v_gate->>'request_hash', v_result
  );

  return v_result;
end;
$$;

revoke all on function public.apply_item_outcome(uuid, uuid, bigint, text, text, timestamptz) from public, anon;
grant execute on function public.apply_item_outcome(uuid, uuid, bigint, text, text, timestamptz) to authenticated;

-- ===========================================================================
-- 9. resolve_issue
-- ===========================================================================
create or replace function public.resolve_issue(
  p_mutation_id uuid,
  p_issue_id uuid,
  p_expected_revision bigint,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_issue public.kdo_issues;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'issue_id', p_issue_id,
    'expected_revision', p_expected_revision,
    'resolution_note', p_resolution_note
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'resolve_issue', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_issue
  from public.kdo_issues i
  where i.id = p_issue_id and i.owner_user_id = v_uid
  for update;

  if not found then raise exception 'issue not found'; end if;
  if v_issue.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_issue.revision;
  end if;
  if v_issue.state = 'resolved' then
    v_result := jsonb_build_object(
      'issue_id', v_issue.id,
      'revision', v_issue.revision,
      'state', v_issue.state
    );
    perform public.kdo_store_mutation_receipt(
      p_mutation_id, 'resolve_issue', v_gate->>'request_hash', v_result
    );
    return v_result;
  end if;

  update public.kdo_issues
  set
    state = 'resolved',
    resolved_at = timezone('utc', now()),
    resolution_note = nullif(btrim(coalesce(p_resolution_note, '')), ''),
    revision = revision + 1,
    updated_at = timezone('utc', now())
  where id = p_issue_id
  returning * into v_issue;

  perform public.kdo_append_activity(
    v_issue.kitchen_id, 'issue', v_issue.id, 'resolve',
    jsonb_build_object('run_id', v_issue.run_id, 'run_item_id', v_issue.run_item_id)
  );

  v_result := jsonb_build_object(
    'issue_id', v_issue.id,
    'revision', v_issue.revision,
    'state', v_issue.state
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'resolve_issue', v_gate->>'request_hash', v_result
  );

  return v_result;
end;
$$;

revoke all on function public.resolve_issue(uuid, uuid, bigint, text) from public, anon;
grant execute on function public.resolve_issue(uuid, uuid, bigint, text) to authenticated;

-- ===========================================================================
-- 10. archive_category / archive_template
-- ===========================================================================
create or replace function public.archive_category(
  p_mutation_id uuid,
  p_category_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_cat public.kdo_categories;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'category_id', p_category_id,
    'expected_revision', p_expected_revision
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'archive_category', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_cat
  from public.kdo_categories c
  where c.id = p_category_id and c.owner_user_id = v_uid
  for update;

  if not found then raise exception 'category not found'; end if;
  if v_cat.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_cat.revision;
  end if;

  update public.kdo_templates
  set category_id = null, revision = revision + 1, updated_at = timezone('utc', now())
  where category_id = p_category_id and owner_user_id = v_uid;

  update public.kdo_categories
  set
    archived_at = coalesce(archived_at, timezone('utc', now())),
    revision = revision + 1,
    updated_at = timezone('utc', now())
  where id = p_category_id
  returning * into v_cat;

  v_result := jsonb_build_object(
    'category_id', v_cat.id,
    'revision', v_cat.revision,
    'archived_at', v_cat.archived_at
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'archive_category', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_cat.kitchen_id, 'category', v_cat.id, 'archive', '{}'::jsonb
  );

  return v_result;
end;
$$;

revoke all on function public.archive_category(uuid, uuid, bigint) from public, anon;
grant execute on function public.archive_category(uuid, uuid, bigint) to authenticated;

create or replace function public.archive_template(
  p_mutation_id uuid,
  p_template_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_gate jsonb;
  v_template public.kdo_templates;
  v_until timestamptz := timezone('utc', now());
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'template_id', p_template_id,
    'expected_revision', p_expected_revision
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'archive_template', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_template
  from public.kdo_templates t
  where t.id = p_template_id and t.owner_user_id = v_uid
  for update;

  if not found then raise exception 'template not found'; end if;
  if v_template.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_template.revision;
  end if;

  update public.kdo_schedules
  set effective_until = v_until
  where template_id = p_template_id
    and owner_user_id = v_uid
    and effective_until is null
    and effective_from < v_until;

  update public.kdo_templates
  set
    state = 'archived',
    revision = revision + 1,
    updated_at = timezone('utc', now())
  where id = p_template_id
  returning * into v_template;

  v_result := jsonb_build_object(
    'template_id', v_template.id,
    'revision', v_template.revision,
    'state', v_template.state
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'archive_template', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_template.kitchen_id, 'template', v_template.id, 'archive', '{}'::jsonb
  );

  return v_result;
end;
$$;

revoke all on function public.archive_template(uuid, uuid, bigint) from public, anon;
grant execute on function public.archive_template(uuid, uuid, bigint) to authenticated;

-- ===========================================================================
-- 11. delete_my_account
-- Auth is not shared with other apps in this project (see decisions.md).
-- Deletes kdo_* rows for the caller, then the Auth user. No target user id param.
-- ===========================================================================
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Child tables cascade from kitchens / auth.users FKs; delete explicitly for clarity.
  delete from public.kdo_activity_events where owner_user_id = v_uid;
  delete from public.kdo_mutation_receipts where owner_user_id = v_uid;
  delete from public.kdo_issues where owner_user_id = v_uid;
  delete from public.kdo_run_items where owner_user_id = v_uid;
  delete from public.kdo_runs where owner_user_id = v_uid;
  delete from public.kdo_schedules where owner_user_id = v_uid;
  delete from public.kdo_template_revisions where owner_user_id = v_uid;
  delete from public.kdo_template_items where owner_user_id = v_uid;
  delete from public.kdo_template_sections where owner_user_id = v_uid;
  delete from public.kdo_templates where owner_user_id = v_uid;
  delete from public.kdo_categories where owner_user_id = v_uid;
  delete from public.kdo_kitchens where owner_user_id = v_uid;
  delete from public.kdo_profiles where user_id = v_uid;

  delete from auth.users where id = v_uid;

  return jsonb_build_object('deleted_user_id', v_uid);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
