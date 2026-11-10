-- Run / issue / archive / account RPCs keyed off membership.

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
  v_owner uuid;
  v_payload jsonb;
  v_gate jsonb;
  v_rev public.kdo_template_revisions;
  v_scheduled_for timestamptz;
  v_due_at timestamptz;
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
  where r.id = p_template_revision_id;

  if not found then raise exception 'template revision not found'; end if;
  v_owner := private.kdo_require_complete(v_rev.kitchen_id);

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
  v_due_at := v_scheduled_for + interval '60 minutes';

  insert into public.kdo_runs (
    id, kitchen_id, owner_user_id, template_id, template_revision_id,
    schedule_id, source, occurrence_key,
    title_snapshot, category_id_snapshot, category_name_snapshot,
    local_date, timezone_snapshot, scheduled_for, due_at, state
  ) values (
    p_run_id, v_rev.kitchen_id, v_owner, v_rev.template_id, v_rev.id,
    null, 'manual', p_occurrence_key,
    v_rev.definition->>'title',
    nullif(v_rev.definition->>'category_id', '')::uuid,
    v_rev.definition->>'category_name',
    p_local_date, p_timezone, v_scheduled_for, v_due_at, 'not_started'
  );

  perform public.kdo_materialize_run_items(p_run_id, v_rev.kitchen_id, v_owner, v_rev.definition);

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

create or replace function public.cancel_run(
  p_mutation_id uuid,
  p_run_id uuid,
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
  v_run public.kdo_runs;
  v_result jsonb;
  v_now timestamptz := timezone('utc', now());
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'run_id', p_run_id,
    'expected_revision', p_expected_revision
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'cancel_run', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_run
  from public.kdo_runs r
  where r.id = p_run_id
  for update;

  if not found then raise exception 'run not found'; end if;
  perform private.kdo_require_complete(v_run.kitchen_id);

  if v_run.state = 'cancelled' then
    v_result := jsonb_build_object(
      'run_id', v_run.id,
      'state', 'cancelled',
      'revision', v_run.revision,
      'already', true
    );
    perform public.kdo_store_mutation_receipt(
      p_mutation_id, 'cancel_run', v_gate->>'request_hash', v_result
    );
    return v_result;
  end if;

  if v_run.state = 'finished' then
    raise exception 'cannot cancel a finished run';
  end if;

  if v_run.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %',
      p_expected_revision, v_run.revision;
  end if;

  update public.kdo_runs
  set
    state = 'cancelled',
    completed_at = null,
    closed_at = coalesce(closed_at, v_now),
    revision = revision + 1,
    updated_at = v_now
  where id = p_run_id
  returning * into v_run;

  v_result := jsonb_build_object(
    'run_id', v_run.id,
    'state', v_run.state,
    'revision', v_run.revision,
    'already', false
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'cancel_run', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_run.kitchen_id, 'run', v_run.id, 'cancel',
    jsonb_build_object('revision', v_run.revision)
  );

  return v_result;
end;
$$;

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
  v_owner uuid;
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

  v_owner := private.kdo_require_member(p_kitchen_id);

  v_day := p_from_date;
  while v_day <= p_to_date loop
    v_iso_dow := extract(isodow from v_day)::integer;

    for v_sched in
      select s.*, t.published_revision
      from public.kdo_schedules s
      join public.kdo_templates t
        on t.id = s.template_id
      where s.kitchen_id = p_kitchen_id
        and t.state = 'active'
        and t.published_revision is not null
        and v_iso_dow = any (s.weekdays)
        and s.effective_from <= ((v_day + s.local_start_time) at time zone p_timezone)
        and (s.effective_until is null
             or s.effective_until > ((v_day + s.local_start_time) at time zone p_timezone))
    loop
      v_local_ts := v_day + v_sched.local_start_time;
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
        and r.published_at <= v_scheduled_for
      order by r.version desc
      limit 1;

      if not found then
        select * into v_rev
        from public.kdo_template_revisions r
        where r.template_id = v_sched.template_id
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
        v_run_id, p_kitchen_id, v_owner, v_sched.template_id, v_rev.id,
        v_sched.id, 'scheduled', v_occurrence_key,
        v_rev.definition->>'title',
        nullif(v_rev.definition->>'category_id', '')::uuid,
        v_rev.definition->>'category_name',
        v_day, p_timezone, v_scheduled_for, v_due_at, 'not_started'
      );

      perform public.kdo_materialize_run_items(v_run_id, p_kitchen_id, v_owner, v_rev.definition);
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
  v_owner uuid;
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
  where i.id = p_run_item_id
  for update;

  if not found then raise exception 'run item not found'; end if;
  v_owner := private.kdo_require_complete(v_item.kitchen_id);
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
        v_item.kitchen_id, v_owner, v_item.run_id, v_item.id, btrim(p_note), 'open', v_recorded_at
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
  where i.id = p_issue_id
  for update;

  if not found then raise exception 'issue not found'; end if;
  perform private.kdo_require_complete(v_issue.kitchen_id);
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
  where c.id = p_category_id
  for update;

  if not found then raise exception 'category not found'; end if;
  perform private.kdo_require_edit(v_cat.kitchen_id);
  if v_cat.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_cat.revision;
  end if;

  update public.kdo_templates
  set category_id = null, revision = revision + 1, updated_at = timezone('utc', now())
  where category_id = p_category_id and kitchen_id = v_cat.kitchen_id;

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
  where t.id = p_template_id
  for update;

  if not found then raise exception 'template not found'; end if;
  perform private.kdo_require_edit(v_template.kitchen_id);
  if v_template.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_template.revision;
  end if;

  update public.kdo_schedules
  set effective_until = v_until
  where template_id = p_template_id
    and kitchen_id = v_template.kitchen_id
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

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_kitchen record;
  v_new_owner uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (
    select 1
    from public.kdo_kitchen_members m
    where m.user_id = v_uid
      and m.role = 'admin'
      and private.kdo_admin_count(m.kitchen_id) = 1
      and private.kdo_member_count(m.kitchen_id) > 1
  ) then
    raise exception 'last admin cannot delete their account while others remain';
  end if;

  for v_kitchen in
    select k.id
    from public.kdo_kitchens k
    where k.owner_user_id = v_uid
  loop
    select m.user_id into v_new_owner
    from public.kdo_kitchen_members m
    where m.kitchen_id = v_kitchen.id
      and m.role = 'admin'
      and m.user_id <> v_uid
    order by m.joined_at
    limit 1;

    if v_new_owner is not null then
      perform private.kdo_reassign_kitchen_owner(v_kitchen.id, v_new_owner);
    end if;
  end loop;

  delete from public.kdo_kitchen_members where user_id = v_uid;
  delete from public.kdo_kitchen_invites where created_by = v_uid;
  delete from public.kdo_mutation_receipts where owner_user_id = v_uid;

  delete from public.kdo_activity_events where owner_user_id = v_uid;
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
