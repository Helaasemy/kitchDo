/**
 * Device-only tables in their current shape. Idempotent; runs after the
 * versioned migrations on every open so a missing table is recreated.
 */
export const LOCAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS local_recurring_tasks (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  title TEXT NOT NULL,
  section_title TEXT,
  template_title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  hidden_at TEXT,
  PRIMARY KEY (user_id, kitchen_id, item_id)
);

CREATE INDEX IF NOT EXISTS local_recurring_tasks_template_idx
  ON local_recurring_tasks (user_id, kitchen_id, template_id);

CREATE TABLE IF NOT EXISTS local_task_ticks (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  title_snapshot TEXT NOT NULL,
  template_title_snapshot TEXT NOT NULL,
  ticked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kitchen_id, item_id, period_key)
);

CREATE INDEX IF NOT EXISTS local_task_ticks_time_idx
  ON local_task_ticks (user_id, kitchen_id, ticked_at);

CREATE TABLE IF NOT EXISTS local_template_sources (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  preset_signature TEXT NOT NULL,
  modified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kitchen_id, template_id)
);

CREATE INDEX IF NOT EXISTS local_template_sources_preset_idx
  ON local_template_sources (user_id, kitchen_id, preset_id);

CREATE TABLE IF NOT EXISTS local_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS local_backups_user_idx
  ON local_backups (user_id, id);
`;

/** Versioned SQLite migrations for device-local cache / outbox. Append only. */
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
  {
    version: 2,
    sql: `
CREATE TABLE IF NOT EXISTS local_repeats (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kitchen_id, template_id)
);
`,
  },
  {
    version: 3,
    sql: `
ALTER TABLE cached_runs ADD COLUMN local_only INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cached_runs ADD COLUMN section_id TEXT;

CREATE TABLE IF NOT EXISTS local_repeat_rules (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  section_key TEXT NOT NULL DEFAULT '',
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  local_time TEXT NOT NULL,
  weekdays TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,7]',
  weekday INTEGER NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 1 AND 7),
  month_day INTEGER NOT NULL DEFAULT 1 CHECK (month_day BETWEEN 1 AND 31),
  effective_from TEXT NOT NULL,
  UNIQUE (user_id, kitchen_id, template_id, section_key)
);

INSERT OR IGNORE INTO local_repeat_rules (
  id, user_id, kitchen_id, template_id, section_key, cadence, local_time, effective_from
)
SELECT lower(hex(randomblob(16))), user_id, kitchen_id, template_id, '', cadence, '08:00', created_at
FROM local_repeats;

DROP TABLE IF EXISTS local_repeats;
`,
  },
  {
    version: 4,
    sql: `
DELETE FROM cached_run_items
  WHERE run_id IN (SELECT id FROM cached_runs WHERE local_only = 1);
DELETE FROM cached_issues
  WHERE run_id IN (SELECT id FROM cached_runs WHERE local_only = 1);
DELETE FROM cached_runs WHERE local_only = 1;
DROP TABLE IF EXISTS local_repeat_rules;

CREATE TABLE IF NOT EXISTS local_recurring_tasks (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  title TEXT NOT NULL,
  section_title TEXT,
  template_title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (user_id, kitchen_id, item_id)
);

CREATE INDEX IF NOT EXISTS local_recurring_tasks_template_idx
  ON local_recurring_tasks (user_id, kitchen_id, template_id);

CREATE TABLE IF NOT EXISTS local_task_ticks (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  title_snapshot TEXT NOT NULL,
  template_title_snapshot TEXT NOT NULL,
  ticked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kitchen_id, item_id, period_key)
);

CREATE INDEX IF NOT EXISTS local_task_ticks_time_idx
  ON local_task_ticks (user_id, kitchen_id, ticked_at);
`,
  },
  {
    version: 5,
    sql: `
CREATE TABLE IF NOT EXISTS local_template_sources (
  user_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  preset_signature TEXT NOT NULL,
  modified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kitchen_id, template_id)
);

CREATE INDEX IF NOT EXISTS local_template_sources_preset_idx
  ON local_template_sources (user_id, kitchen_id, preset_id);
`,
  },
  {
    version: 6,
    sql: `
ALTER TABLE local_recurring_tasks ADD COLUMN hidden_at TEXT;

CREATE TABLE IF NOT EXISTS local_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS local_backups_user_idx
  ON local_backups (user_id, id);
`,
  },
];
