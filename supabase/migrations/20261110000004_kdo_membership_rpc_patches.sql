-- Replace owner-only lookups in existing RPCs with membership helpers.

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
  v_owner uuid;
  v_payload jsonb;
  v_gate jsonb;
  v_template public.kdo_templates;
  v_section jsonb;
  v_item jsonb;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_owner := private.kdo_require_edit(p_kitchen_id);

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

  select * into v_template
  from public.kdo_templates t
  where t.id = p_template_id
  for update;

  if not found then
    insert into public.kdo_templates (
      id, kitchen_id, owner_user_id, category_id, title, description, state, revision
    ) values (
      p_template_id, p_kitchen_id, v_owner, p_category_id, btrim(p_title), p_description, 'draft', 1
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

  delete from public.kdo_template_items where template_id = p_template_id;
  delete from public.kdo_template_sections where template_id = p_template_id;

  for v_section in
    select value from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb))
  loop
    insert into public.kdo_template_sections (
      id, template_id, kitchen_id, owner_user_id, title, sort_order
    ) values (
      coalesce(nullif(v_section->>'id', '')::uuid, gen_random_uuid()),
      p_template_id, p_kitchen_id, v_owner,
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
      p_template_id, p_kitchen_id, v_owner,
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
  v_owner uuid;
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
  where t.id = p_template_id
  for update;

  if not found then raise exception 'template not found'; end if;
  v_owner := private.kdo_require_edit(v_template.kitchen_id);
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
    v_revision_id, v_template.id, v_template.kitchen_id, v_owner, v_version, v_definition
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
  v_owner uuid;
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
  where t.id = p_template_id;

  if not found then raise exception 'template not found'; end if;
  v_owner := private.kdo_require_edit(v_src.kitchen_id);

  insert into public.kdo_templates (
    id, kitchen_id, owner_user_id, category_id, title, description, state, published_revision, revision
  ) values (
    v_new_id, v_src.kitchen_id, v_owner, v_src.category_id,
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
      v_new_section_id, v_new_id, v_src.kitchen_id, v_owner, v_section.title, v_section.sort_order
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
      gen_random_uuid(), v_new_id, v_src.kitchen_id, v_owner,
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
  v_owner uuid;
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
  where t.id = p_template_id;

  if not found then raise exception 'template not found'; end if;
  v_owner := private.kdo_require_edit(v_template.kitchen_id);
  if v_template.state = 'archived' then raise exception 'cannot schedule archived template'; end if;
  if v_template.published_revision is null then raise exception 'template must be published'; end if;

  update public.kdo_schedules s
  set effective_until = p_effective_from
  where s.series_id = v_series_id
    and s.kitchen_id = v_template.kitchen_id
    and s.effective_until is null
    and s.effective_from < p_effective_from;

  insert into public.kdo_schedules (
    id, series_id, template_id, kitchen_id, owner_user_id,
    weekdays, local_start_time, due_after_minutes,
    effective_from, effective_until,
    reminder_enabled, reminder_lead_minutes
  ) values (
    v_schedule_id, v_series_id, p_template_id, v_template.kitchen_id, v_owner,
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
    and s.effective_until is null
  order by s.effective_from desc
  limit 1
  for update;

  if not found then
    raise exception 'active schedule series not found';
  end if;
  perform private.kdo_require_edit(v_schedule.kitchen_id);

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
