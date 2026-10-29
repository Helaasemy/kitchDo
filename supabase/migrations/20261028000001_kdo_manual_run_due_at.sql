-- Give Use-now (manual) runs a default 60-minute due window so countdown UI works.
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
  v_due_at := v_scheduled_for + interval '60 minutes';

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
    p_local_date, p_timezone, v_scheduled_for, v_due_at, 'not_started'
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
