/** Versioned SQLite migrations for device-local cache / outbox. */
export const SQLITE_MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, kitchen_id, key)
);

CREATE TABLE IF NOT EXISTS cached_revisions (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  published_at TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  title TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS cached_revisions_kitchen_idx
  ON cached_revisions (user_id, kitchen_id, template_id);

CREATE TABLE IF NOT EXISTS cached_runs (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_revision_id TEXT NOT NULL,
  schedule_id TEXT,
  source TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  title_snapshot TEXT NOT NULL,
  category_id_snapshot TEXT,
  category_name_snapshot TEXT,
  local_date TEXT NOT NULL,
  timezone_snapshot TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  due_at TEXT,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL,
  completed_at TEXT,
  closed_at TEXT,
  updated_at TEXT NOT NULL,
  pending_create INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS cached_runs_occurrence_uidx
  ON cached_runs (user_id, kitchen_id, occurrence_key);

CREATE INDEX IF NOT EXISTS cached_runs_date_idx
  ON cached_runs (user_id, kitchen_id, local_date, scheduled_for);

CREATE TABLE IF NOT EXISTS cached_run_items (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  source_section_id TEXT,
  section_title_snapshot TEXT,
  section_order_snapshot INTEGER,
  title_snapshot TEXT NOT NULL,
  instructions_snapshot TEXT,
  response_type_snapshot TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  note TEXT,
  recorded_at TEXT,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS cached_run_items_run_idx
  ON cached_run_items (user_id, run_id, sort_order);

CREATE TABLE IF NOT EXISTS cached_issues (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  run_item_id TEXT,
  description TEXT NOT NULL,
  state TEXT NOT NULL,
  resolution_note TEXT,
  reported_at TEXT NOT NULL,
  resolved_at TEXT,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS cached_issues_run_idx
  ON cached_issues (user_id, run_id);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  mutation_id TEXT NOT NULL UNIQUE,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  reported_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS outbox_fifo_idx
  ON outbox (user_id, kitchen_id, created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS notification_map (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  fire_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kitchen_id, occurrence_key)
);
`,
  },
];
