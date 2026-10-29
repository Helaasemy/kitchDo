-- Soft-delete a run: mark cancelled so it leaves Today / open-run reuse.
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
  where r.id = p_run_id and r.owner_user_id = v_uid
  for update;

  if not found then raise exception 'run not found'; end if;

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

revoke all on function public.cancel_run(uuid, uuid, bigint) from public, anon;
grant execute on function public.cancel_run(uuid, uuid, bigint) to authenticated;
