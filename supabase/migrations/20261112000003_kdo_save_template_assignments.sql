-- Assign list default + task overrides without rewriting the checklist.

create or replace function public.save_template_assignments(
  p_mutation_id uuid,
  p_template_id uuid,
  p_kitchen_id uuid,
  p_expected_revision bigint,
  p_assignee_user_id uuid default null,
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
  v_item jsonb;
  v_result jsonb;
  v_list_assignee uuid;
  v_item_assignee uuid;
  v_item_mode text;
  v_item_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  perform private.kdo_require_edit(p_kitchen_id);
  v_list_assignee := private.kdo_require_member_id(p_kitchen_id, p_assignee_user_id);

  v_payload := jsonb_build_object(
    'template_id', p_template_id,
    'kitchen_id', p_kitchen_id,
    'expected_revision', p_expected_revision,
    'assignee_user_id', v_list_assignee,
    'items', coalesce(p_items, '[]'::jsonb)
  );
  v_gate := public.kdo_begin_mutation(p_mutation_id, 'save_template_assignments', v_payload);
  if (v_gate->>'replay')::boolean then
    return v_gate->'result';
  end if;

  select * into v_template
  from public.kdo_templates t
  where t.id = p_template_id
  for update;

  if not found then raise exception 'template not found'; end if;
  if v_template.kitchen_id <> p_kitchen_id then raise exception 'kitchen mismatch'; end if;
  if v_template.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, v_template.revision;
  end if;
  if v_template.state = 'archived' then
    raise exception 'cannot edit archived template';
  end if;

  update public.kdo_templates
  set
    assignee_user_id = v_list_assignee,
    revision = revision + 1,
    updated_at = timezone('utc', now())
  where id = p_template_id
  returning * into v_template;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_item_id := nullif(v_item->>'id', '')::uuid;
    if v_item_id is null then
      raise exception 'item id required';
    end if;
    if not exists (
      select 1 from public.kdo_template_items i
      where i.id = v_item_id and i.template_id = p_template_id
    ) then
      raise exception 'item does not belong to template';
    end if;

    v_item_mode := case
      when coalesce(v_item->>'assignee_mode', 'inherit') = 'explicit' then 'explicit'
      else 'inherit'
    end;
    v_item_assignee := case
      when v_item_mode = 'explicit' then
        private.kdo_require_member_id(
          p_kitchen_id,
          nullif(v_item->>'assignee_user_id', '')::uuid
        )
      else
        null
    end;

    update public.kdo_template_items
    set
      assignee_user_id = v_item_assignee,
      assignee_mode = v_item_mode
    where id = v_item_id and template_id = p_template_id;
  end loop;

  v_result := jsonb_build_object(
    'template_id', v_template.id,
    'revision', v_template.revision
  );

  perform public.kdo_store_mutation_receipt(
    p_mutation_id, 'save_template_assignments', v_gate->>'request_hash', v_result
  );
  perform public.kdo_append_activity(
    p_kitchen_id, 'template', p_template_id, 'assign',
    jsonb_build_object('revision', v_template.revision)
  );

  return v_result;
end;
$$;

revoke all on function public.save_template_assignments(
  uuid, uuid, uuid, bigint, uuid, jsonb
) from public, anon;
grant execute on function public.save_template_assignments(
  uuid, uuid, uuid, bigint, uuid, jsonb
) to authenticated;

notify pgrst, 'reload schema';
