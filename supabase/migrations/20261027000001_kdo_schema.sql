-- KitchDo Stage C: public.kdo_* schema (tables, constraints, indexes)
-- Additive only. No invitation/membership tables.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.kdo_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8.1 kdo_profiles
-- ---------------------------------------------------------------------------
create table public.kdo_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    constraint kdo_profiles_display_name_nonblank
      check (char_length(btrim(display_name)) > 0 and char_length(display_name) <= 120),
  locale text
    constraint kdo_profiles_locale_len check (locale is null or char_length(locale) <= 32),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger kdo_profiles_set_updated_at
  before update on public.kdo_profiles
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.2 kdo_kitchens
-- ---------------------------------------------------------------------------
create table public.kdo_kitchens (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null
    constraint kdo_kitchens_kind_check check (kind in ('home', 'business')),
  name text not null
    constraint kdo_kitchens_name_nonblank
      check (char_length(btrim(name)) > 0 and char_length(name) <= 120),
  archived_at timestamptz,
  revision bigint not null default 1
    constraint kdo_kitchens_revision_positive check (revision >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kdo_kitchens_id_owner_key unique (id, owner_user_id)
);

create index kdo_kitchens_owner_user_id_idx
  on public.kdo_kitchens (owner_user_id);

create index kdo_kitchens_owner_active_idx
  on public.kdo_kitchens (owner_user_id)
  where archived_at is null;

create trigger kdo_kitchens_set_updated_at
  before update on public.kdo_kitchens
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.3 kdo_categories
-- ---------------------------------------------------------------------------
create table public.kdo_categories (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  name text not null
    constraint kdo_categories_name_nonblank
      check (char_length(btrim(name)) > 0 and char_length(name) <= 120),
  sort_order integer not null default 0,
  archived_at timestamptz,
  revision bigint not null default 1
    constraint kdo_categories_revision_positive check (revision >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kdo_categories_kitchen_owner_fkey
    foreign key (kitchen_id, owner_user_id)
    references public.kdo_kitchens (id, owner_user_id)
    on delete cascade,
  constraint kdo_categories_id_kitchen_owner_key unique (id, kitchen_id, owner_user_id)
);

create unique index kdo_categories_kitchen_active_name_uidx
  on public.kdo_categories (kitchen_id, lower(btrim(name)))
  where archived_at is null;

create index kdo_categories_kitchen_sort_idx
  on public.kdo_categories (kitchen_id, sort_order);

create index kdo_categories_owner_user_id_idx
  on public.kdo_categories (owner_user_id);

create trigger kdo_categories_set_updated_at
  before update on public.kdo_categories
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.4 kdo_templates
-- ---------------------------------------------------------------------------
create table public.kdo_templates (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  category_id uuid,
  title text not null
    constraint kdo_templates_title_nonblank
      check (char_length(btrim(title)) > 0 and char_length(title) <= 200),
  description text
    constraint kdo_templates_description_len
      check (description is null or char_length(description) <= 4000),
  state text not null default 'draft'
    constraint kdo_templates_state_check check (state in ('draft', 'active', 'archived')),
  published_revision integer
    constraint kdo_templates_published_revision_positive
      check (published_revision is null or published_revision >= 1),
  revision bigint not null default 1
    constraint kdo_templates_revision_positive check (revision >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kdo_templates_kitchen_owner_fkey
    foreign key (kitchen_id, owner_user_id)
    references public.kdo_kitchens (id, owner_user_id)
    on delete cascade,
  constraint kdo_templates_category_fkey
    foreign key (category_id, kitchen_id, owner_user_id)
    references public.kdo_categories (id, kitchen_id, owner_user_id)
    on delete set null,
  constraint kdo_templates_id_kitchen_owner_key unique (id, kitchen_id, owner_user_id),
  constraint kdo_templates_id_owner_key unique (id, owner_user_id)
);

create index kdo_templates_kitchen_state_category_idx
  on public.kdo_templates (kitchen_id, state, category_id);

create index kdo_templates_owner_user_id_idx
  on public.kdo_templates (owner_user_id);

create trigger kdo_templates_set_updated_at
  before update on public.kdo_templates
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.5 kdo_template_sections
-- ---------------------------------------------------------------------------
create table public.kdo_template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  title text not null
    constraint kdo_template_sections_title_nonblank
      check (char_length(btrim(title)) > 0 and char_length(title) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kdo_template_sections_template_fkey
    foreign key (template_id, kitchen_id, owner_user_id)
    references public.kdo_templates (id, kitchen_id, owner_user_id)
    on delete cascade,
  constraint kdo_template_sections_id_template_key unique (id, template_id)
);

create index kdo_template_sections_template_sort_idx
  on public.kdo_template_sections (template_id, sort_order);

create index kdo_template_sections_owner_user_id_idx
  on public.kdo_template_sections (owner_user_id);

create trigger kdo_template_sections_set_updated_at
  before update on public.kdo_template_sections
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.6 kdo_template_items
-- ---------------------------------------------------------------------------
create table public.kdo_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  section_id uuid,
  title text not null
    constraint kdo_template_items_title_nonblank
      check (char_length(btrim(title)) > 0 and char_length(title) <= 200),
  instructions text
    constraint kdo_template_items_instructions_len
      check (instructions is null or char_length(instructions) <= 4000),
  response_type text not null default 'checkbox'
    constraint kdo_template_items_response_type_check check (response_type = 'checkbox'),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kdo_template_items_template_fkey
    foreign key (template_id, kitchen_id, owner_user_id)
    references public.kdo_templates (id, kitchen_id, owner_user_id)
    on delete cascade,
  constraint kdo_template_items_section_fkey
    foreign key (section_id, template_id)
    references public.kdo_template_sections (id, template_id)
    on delete set null,
  constraint kdo_template_items_id_template_key unique (id, template_id)
);

create index kdo_template_items_template_section_sort_idx
  on public.kdo_template_items (template_id, section_id, sort_order);

create index kdo_template_items_owner_user_id_idx
  on public.kdo_template_items (owner_user_id);

create trigger kdo_template_items_set_updated_at
  before update on public.kdo_template_items
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.7 kdo_template_revisions (immutable published snapshots)
-- ---------------------------------------------------------------------------
create table public.kdo_template_revisions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  version integer not null
    constraint kdo_template_revisions_version_positive check (version >= 1),
  definition jsonb not null
    constraint kdo_template_revisions_definition_object check (jsonb_typeof(definition) = 'object'),
  published_at timestamptz not null default timezone('utc', now()),
  constraint kdo_template_revisions_template_fkey
    foreign key (template_id, kitchen_id, owner_user_id)
    references public.kdo_templates (id, kitchen_id, owner_user_id)
    on delete cascade,
  constraint kdo_template_revisions_template_version_key unique (template_id, version),
  constraint kdo_template_revisions_id_owner_key unique (id, owner_user_id),
  constraint kdo_template_revisions_id_kitchen_owner_key unique (id, kitchen_id, owner_user_id)
);

create index kdo_template_revisions_template_version_idx
  on public.kdo_template_revisions (template_id, version);

create index kdo_template_revisions_owner_user_id_idx
  on public.kdo_template_revisions (owner_user_id);

-- ---------------------------------------------------------------------------
-- 8.8 kdo_schedules (immutable interval revisions)
-- ---------------------------------------------------------------------------
create table public.kdo_schedules (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null,
  template_id uuid not null,
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  weekdays smallint[] not null
    constraint kdo_schedules_weekdays_nonempty check (cardinality(weekdays) >= 1),
  local_start_time time without time zone not null,
  due_after_minutes integer not null
    constraint kdo_schedules_due_after_bounds check (due_after_minutes >= 1 and due_after_minutes <= 10080),
  effective_from timestamptz not null,
  effective_until timestamptz,
  reminder_enabled boolean not null default false,
  reminder_lead_minutes integer not null default 0
    constraint kdo_schedules_reminder_lead_nonneg check (reminder_lead_minutes >= 0 and reminder_lead_minutes <= 10080),
  created_at timestamptz not null default timezone('utc', now()),
  constraint kdo_schedules_template_fkey
    foreign key (template_id, kitchen_id, owner_user_id)
    references public.kdo_templates (id, kitchen_id, owner_user_id)
    on delete cascade,
  constraint kdo_schedules_until_after_from
    check (effective_until is null or effective_until > effective_from),
  constraint kdo_schedules_weekdays_valid check (
    weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
    and cardinality(weekdays) between 1 and 7
  ),
  constraint kdo_schedules_series_no_overlap
    exclude using gist (
      series_id with =,
      tstzrange(effective_from, coalesce(effective_until, 'infinity'::timestamptz), '[)') with &&
    )
);

create index kdo_schedules_series_from_idx
  on public.kdo_schedules (series_id, effective_from);

create index kdo_schedules_template_idx
  on public.kdo_schedules (template_id);

create index kdo_schedules_kitchen_active_idx
  on public.kdo_schedules (kitchen_id, effective_from)
  where effective_until is null;

create index kdo_schedules_owner_user_id_idx
  on public.kdo_schedules (owner_user_id);

-- ---------------------------------------------------------------------------
-- 8.9 kdo_runs
-- ---------------------------------------------------------------------------
create table public.kdo_runs (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  template_id uuid not null,
  template_revision_id uuid not null,
  schedule_id uuid,
  source text not null
    constraint kdo_runs_source_check check (source in ('manual', 'scheduled')),
  occurrence_key text not null
    constraint kdo_runs_occurrence_key_nonblank
      check (char_length(btrim(occurrence_key)) > 0 and char_length(occurrence_key) <= 200),
  title_snapshot text not null
    constraint kdo_runs_title_snapshot_nonblank
      check (char_length(btrim(title_snapshot)) > 0 and char_length(title_snapshot) <= 200),
  category_id_snapshot uuid,
  category_name_snapshot text
    constraint kdo_runs_category_name_snapshot_len
      check (category_name_snapshot is null or char_length(category_name_snapshot) <= 120),
  local_date date not null,
  timezone_snapshot text not null
    constraint kdo_runs_timezone_snapshot_nonblank
      check (char_length(btrim(timezone_snapshot)) > 0 and char_length(timezone_snapshot) <= 64),
  scheduled_for timestamptz not null,
  due_at timestamptz,
  state text not null default 'not_started'
    constraint kdo_runs_state_check
      check (state in ('not_started', 'in_progress', 'finished', 'cancelled')),
  completed_at timestamptz,
  closed_at timestamptz,
  revision bigint not null default 1
    constraint kdo_runs_revision_positive check (revision >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kdo_runs_kitchen_owner_fkey
    foreign key (kitchen_id, owner_user_id)
    references public.kdo_kitchens (id, owner_user_id)
    on delete cascade,
  constraint kdo_runs_template_fkey
    foreign key (template_id, kitchen_id, owner_user_id)
    references public.kdo_templates (id, kitchen_id, owner_user_id)
    on delete restrict,
  constraint kdo_runs_revision_fkey
    foreign key (template_revision_id, kitchen_id, owner_user_id)
    references public.kdo_template_revisions (id, kitchen_id, owner_user_id)
    on delete restrict,
  constraint kdo_runs_schedule_fkey
    foreign key (schedule_id)
    references public.kdo_schedules (id)
    on delete set null,
  constraint kdo_runs_source_schedule_consistency check (
    (source = 'manual' and schedule_id is null)
    or (source = 'scheduled' and schedule_id is not null)
  ),
  constraint kdo_runs_kitchen_occurrence_key unique (kitchen_id, occurrence_key),
  constraint kdo_runs_id_kitchen_owner_key unique (id, kitchen_id, owner_user_id)
);

create index kdo_runs_kitchen_local_date_scheduled_idx
  on public.kdo_runs (kitchen_id, local_date, scheduled_for);

create index kdo_runs_kitchen_state_idx
  on public.kdo_runs (kitchen_id, state);

create index kdo_runs_owner_user_id_idx
  on public.kdo_runs (owner_user_id);

create index kdo_runs_template_revision_id_idx
  on public.kdo_runs (template_revision_id);

create index kdo_runs_schedule_id_idx
  on public.kdo_runs (schedule_id);

create trigger kdo_runs_set_updated_at
  before update on public.kdo_runs
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.10 kdo_run_items
-- ---------------------------------------------------------------------------
create table public.kdo_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  source_item_id uuid not null,
  source_section_id uuid,
  section_title_snapshot text
    constraint kdo_run_items_section_title_len
      check (section_title_snapshot is null or char_length(section_title_snapshot) <= 200),
  section_order_snapshot integer,
  title_snapshot text not null
    constraint kdo_run_items_title_nonblank
      check (char_length(btrim(title_snapshot)) > 0 and char_length(title_snapshot) <= 200),
  instructions_snapshot text
    constraint kdo_run_items_instructions_len
      check (instructions_snapshot is null or char_length(instructions_snapshot) <= 4000),
  response_type_snapshot text not null default 'checkbox'
    constraint kdo_run_items_response_type_check check (response_type_snapshot = 'checkbox'),
  sort_order integer not null default 0,
  outcome text not null default 'pending'
    constraint kdo_run_items_outcome_check
      check (outcome in ('pending', 'done', 'not_applicable', 'blocked')),
  note text
    constraint kdo_run_items_note_len check (note is null or char_length(note) <= 4000),
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz,
  received_at timestamptz,
  revision bigint not null default 1
    constraint kdo_run_items_revision_positive check (revision >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kdo_run_items_run_fkey
    foreign key (run_id, kitchen_id, owner_user_id)
    references public.kdo_runs (id, kitchen_id, owner_user_id)
    on delete cascade,
  constraint kdo_run_items_reason_required check (
    outcome in ('pending', 'done')
    or (note is not null and char_length(btrim(note)) > 0)
  ),
  constraint kdo_run_items_pending_clean check (
    outcome <> 'pending'
    or (recorded_by is null and recorded_at is null and received_at is null and note is null)
  ),
  constraint kdo_run_items_id_run_key unique (id, run_id),
  constraint kdo_run_items_id_kitchen_owner_key unique (id, kitchen_id, owner_user_id)
);

create index kdo_run_items_run_sort_idx
  on public.kdo_run_items (run_id, sort_order);

create index kdo_run_items_owner_user_id_idx
  on public.kdo_run_items (owner_user_id);

create trigger kdo_run_items_set_updated_at
  before update on public.kdo_run_items
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.11 kdo_issues
-- ---------------------------------------------------------------------------
create table public.kdo_issues (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null,
  owner_user_id uuid not null,
  run_id uuid not null,
  run_item_id uuid,
  description text not null
    constraint kdo_issues_description_nonblank
      check (char_length(btrim(description)) > 0 and char_length(description) <= 4000),
  state text not null default 'open'
    constraint kdo_issues_state_check check (state in ('open', 'resolved')),
  reported_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  resolution_note text
    constraint kdo_issues_resolution_note_len
      check (resolution_note is null or char_length(resolution_note) <= 4000),
  revision bigint not null default 1
    constraint kdo_issues_revision_positive check (revision >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kdo_issues_kitchen_owner_fkey
    foreign key (kitchen_id, owner_user_id)
    references public.kdo_kitchens (id, owner_user_id)
    on delete cascade,
  constraint kdo_issues_run_fkey
    foreign key (run_id, kitchen_id, owner_user_id)
    references public.kdo_runs (id, kitchen_id, owner_user_id)
    on delete cascade,
  constraint kdo_issues_run_item_fkey
    foreign key (run_item_id, run_id)
    references public.kdo_run_items (id, run_id)
    on delete set null,
  constraint kdo_issues_resolved_consistency check (
    (state = 'open' and resolved_at is null)
    or (state = 'resolved' and resolved_at is not null)
  )
);

create unique index kdo_issues_run_item_uidx
  on public.kdo_issues (run_item_id)
  where run_item_id is not null;

create index kdo_issues_kitchen_state_created_idx
  on public.kdo_issues (kitchen_id, state, created_at);

create index kdo_issues_owner_user_id_idx
  on public.kdo_issues (owner_user_id);

create trigger kdo_issues_set_updated_at
  before update on public.kdo_issues
  for each row execute function public.kdo_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8.12 kdo_mutation_receipts + kdo_activity_events
-- ---------------------------------------------------------------------------
create table public.kdo_mutation_receipts (
  id uuid not null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  operation text not null
    constraint kdo_mutation_receipts_operation_nonblank
      check (char_length(btrim(operation)) > 0 and char_length(operation) <= 80),
  request_hash text not null
    constraint kdo_mutation_receipts_request_hash_nonblank
      check (char_length(btrim(request_hash)) > 0 and char_length(request_hash) <= 128),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id)
);

create index kdo_mutation_receipts_owner_created_idx
  on public.kdo_mutation_receipts (owner_user_id, created_at desc);

create table public.kdo_activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  kitchen_id uuid not null,
  entity_type text not null
    constraint kdo_activity_events_entity_type_nonblank
      check (char_length(btrim(entity_type)) > 0 and char_length(entity_type) <= 64),
  entity_id uuid not null,
  action text not null
    constraint kdo_activity_events_action_nonblank
      check (char_length(btrim(action)) > 0 and char_length(action) <= 64),
  context jsonb not null default '{}'::jsonb
    constraint kdo_activity_events_context_object check (jsonb_typeof(context) = 'object'),
  reported_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  constraint kdo_activity_events_kitchen_owner_fkey
    foreign key (kitchen_id, owner_user_id)
    references public.kdo_kitchens (id, owner_user_id)
    on delete cascade
);

create index kdo_activity_events_kitchen_received_idx
  on public.kdo_activity_events (kitchen_id, received_at desc);

create index kdo_activity_events_entity_idx
  on public.kdo_activity_events (entity_type, entity_id);

create index kdo_activity_events_owner_user_id_idx
  on public.kdo_activity_events (owner_user_id);
