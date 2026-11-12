-- Assignment RPCs: persist list + item assignees on save/duplicate/publish snapshot.

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
      'sort_order', i.sort_order,
      'assignee_user_id', i.assignee_user_id,
      'assignee_mode', i.assignee_mode
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
    'assignee_user_id', p_template.assignee_user_id,
    'sections', v_sections,
    'items', v_items
  );
end;
$$;

revoke all on function public.kdo_build_template_definition(public.kdo_templates) from public, anon, authenticated;

drop function if exists public.save_template_draft(uuid, uuid, uuid, bigint, text, text, uuid, jsonb, jsonb);

create or replace function public.save_template_draft(
  p_mutation_id uuid,
  p_template_id uuid,
  p_kitchen_id uuid,
  p_expected_revision bigint,
  p_title text,
  p_description text default null,
  p_category_id uuid default null,
  p_sections jsonb default '[]'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_assignee_user_id uuid default null
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
  v_list_assignee uuid;
  v_item_assignee uuid;
  v_item_mode text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_owner := private.kdo_require_edit(p_kitchen_id);
  v_list_assignee := private.kdo_require_member_id(p_kitchen_id, p_assignee_user_id);

  v_payload := jsonb_build_object(
    'template_id', p_template_id,
    'kitchen_id', p_kitchen_id,
    'expected_revision', p_expected_revision,
    'title', p_title,
    'description', p_description,
    'category_id', p_category_id,
    'assignee_user_id', v_list_assignee,
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
      id, kitchen_id, owner_user_id, category_id, title, description, state, revision, assignee_user_id
    ) values (
      p_template_id, p_kitchen_id, v_owner, p_category_id, btrim(p_title), p_description, 'draft', 1, v_list_assignee
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
      assignee_user_id = v_list_assignee,
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

    insert into public.kdo_template_items (
      id, template_id, kitchen_id, owner_user_id, section_id,
      title, instructions, response_type, sort_order,
      assignee_user_id, assignee_mode
    ) values (
      coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
      p_template_id, p_kitchen_id, v_owner,
      nullif(v_item->>'section_id', '')::uuid,
      btrim(v_item->>'title'),
      v_item->>'instructions',
      'checkbox',
      coalesce((v_item->>'sort_order')::integer, 0),
      v_item_assignee,
      v_item_mode
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

revoke all on function public.save_template_draft(
  uuid, uuid, uuid, bigint, text, text, uuid, jsonb, jsonb, uuid
) from public, anon;
grant execute on function public.save_template_draft(
  uuid, uuid, uuid, bigint, text, text, uuid, jsonb, jsonb, uuid
) to authenticated;

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
    id, kitchen_id, owner_user_id, category_id, title, description, state, published_revision, revision, assignee_user_id
  ) values (
    v_new_id, v_src.kitchen_id, v_owner, v_src.category_id,
    left(v_src.title || ' (copy)', 200),
    v_src.description,
    'draft',
    null,
    1,
    v_src.assignee_user_id
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
      title, instructions, response_type, sort_order,
      assignee_user_id, assignee_mode
    ) values (
      gen_random_uuid(), v_new_id, v_src.kitchen_id, v_owner,
      case
        when v_item.section_id is null then null
        else (v_section_map ->> v_item.section_id::text)::uuid
      end,
      v_item.title, v_item.instructions, v_item.response_type, v_item.sort_order,
      v_item.assignee_user_id, v_item.assignee_mode
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
