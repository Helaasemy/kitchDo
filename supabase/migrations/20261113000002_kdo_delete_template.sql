-- Real template delete, distinct from archive.
-- Runs used ON DELETE RESTRICT, so a used list could never be removed.

alter table public.kdo_runs
  drop constraint kdo_runs_template_fkey,
  drop constraint kdo_runs_revision_fkey;

alter table public.kdo_runs
  add constraint kdo_runs_template_fkey
    foreign key (template_id, kitchen_id, owner_user_id)
    references public.kdo_templates (id, kitchen_id, owner_user_id)
    on delete cascade,
  add constraint kdo_runs_revision_fkey
    foreign key (template_revision_id, kitchen_id, owner_user_id)
    references public.kdo_template_revisions (id, kitchen_id, owner_user_id)
    on delete cascade;

create or replace function public.delete_template(
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
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_payload := jsonb_build_object(
    'template_id', p_template_id,
    'expected_revision', p_expected_revision
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'delete_template', v_payload);
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

  delete from public.kdo_templates where id = p_template_id;

  v_result := jsonb_build_object(
    'template_id', p_template_id,
    'deleted', true
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'delete_template', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    v_template.kitchen_id, 'template', p_template_id, 'delete', '{}'::jsonb
  );

  return v_result;
end;
$$;

revoke all on function public.delete_template(uuid, uuid, bigint) from public, anon;
grant execute on function public.delete_template(uuid, uuid, bigint) to authenticated;
