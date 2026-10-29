-- Harden SECURITY DEFINER execute grants: revoke PUBLIC/anon; keep public RPCs on authenticated only.
-- Internal helpers: no client execute (callable only by definer/owner chain).

-- Internal helpers — revoke from everyone except privileged owners
revoke all on function public.kdo_begin_mutation(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.kdo_store_mutation_receipt(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.kdo_append_activity(uuid, text, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.kdo_materialize_run_items(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.kdo_reconcile_run_progress(uuid) from public, anon, authenticated;
revoke all on function public.kdo_build_template_definition(public.kdo_templates) from public, anon, authenticated;
revoke all on function public.kdo_schedules_validate_weekdays() from public, anon, authenticated;
revoke all on function public.kdo_set_updated_at() from public, anon, authenticated;

-- Public RPCs — ensure PUBLIC/anon cannot execute; authenticated only
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'complete_onboarding',
        'save_template_draft',
        'publish_template',
        'duplicate_template',
        'revise_schedule',
        'pause_schedule',
        'create_manual_run',
        'ensure_scheduled_occurrences',
        'apply_item_outcome',
        'resolve_issue',
        'archive_category',
        'archive_template',
        'delete_my_account',
        'kdo_current_user_id',
        'kdo_require_user_id',
        'kdo_request_hash'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- DEFINER RPCs: reaffirm authenticated-only (lint 0028 fix for anon/public)
revoke all on function public.save_template_draft(uuid, uuid, uuid, bigint, text, text, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.publish_template(uuid, uuid, bigint) from public, anon;
revoke all on function public.duplicate_template(uuid, uuid, uuid) from public, anon;
revoke all on function public.revise_schedule(uuid, uuid, uuid, smallint[], time, integer, timestamptz, boolean, integer, uuid) from public, anon;
revoke all on function public.pause_schedule(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.create_manual_run(uuid, uuid, uuid, text, date, text, timestamptz) from public, anon;
revoke all on function public.ensure_scheduled_occurrences(uuid, date, date, text) from public, anon;
revoke all on function public.apply_item_outcome(uuid, uuid, bigint, text, text, timestamptz) from public, anon;
revoke all on function public.resolve_issue(uuid, uuid, bigint, text) from public, anon;
revoke all on function public.archive_category(uuid, uuid, bigint) from public, anon;
revoke all on function public.archive_template(uuid, uuid, bigint) from public, anon;
revoke all on function public.delete_my_account() from public, anon;

grant execute on function public.save_template_draft(uuid, uuid, uuid, bigint, text, text, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.publish_template(uuid, uuid, bigint) to authenticated;
grant execute on function public.duplicate_template(uuid, uuid, uuid) to authenticated;
grant execute on function public.revise_schedule(uuid, uuid, uuid, smallint[], time, integer, timestamptz, boolean, integer, uuid) to authenticated;
grant execute on function public.pause_schedule(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.create_manual_run(uuid, uuid, uuid, text, date, text, timestamptz) to authenticated;
grant execute on function public.ensure_scheduled_occurrences(uuid, date, date, text) to authenticated;
grant execute on function public.apply_item_outcome(uuid, uuid, bigint, text, text, timestamptz) to authenticated;
grant execute on function public.resolve_issue(uuid, uuid, bigint, text) to authenticated;
grant execute on function public.archive_category(uuid, uuid, bigint) to authenticated;
grant execute on function public.archive_template(uuid, uuid, bigint) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
