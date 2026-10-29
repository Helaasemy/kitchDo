export type CachedRun = {
  id: string;
  userId: string;
  kitchenId: string;
  templateId: string;
  templateRevisionId: string;
  scheduleId: string | null;
  source: string;
  occurrenceKey: string;
  titleSnapshot: string;
  categoryIdSnapshot: string | null;
  categoryNameSnapshot: string | null;
  localDate: string;
  timezoneSnapshot: string;
  scheduledFor: string;
  dueAt: string | null;
  state: string;
  revision: number;
  completedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  pendingCreate: boolean;
};

export type CachedRunItem = {
  id: string;
  userId: string;
  kitchenId: string;
  runId: string;
  sourceItemId: string;
  sourceSectionId: string | null;
  sectionTitleSnapshot: string | null;
  sectionOrderSnapshot: number | null;
  titleSnapshot: string;
  instructionsSnapshot: string | null;
  responseTypeSnapshot: string;
  sortOrder: number;
  outcome: string;
  note: string | null;
  recordedAt: string | null;
  revision: number;
  updatedAt: string;
};

export type CachedIssue = {
  id: string;
  userId: string;
  kitchenId: string;
  runId: string;
  runItemId: string | null;
  description: string;
  state: string;
  resolutionNote: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  revision: number;
  updatedAt: string;
};

export type CachedRevision = {
  id: string;
  userId: string;
  kitchenId: string;
  templateId: string;
  version: number;
  publishedAt: string;
  definitionJson: string;
  title: string;
};

export type OutboxOperation =
  | 'create_manual_run'
  | 'apply_item_outcome'
  | 'resolve_issue'
  | 'cancel_run';

export type OutboxRow = {
  id: string;
  userId: string;
  kitchenId: string;
  mutationId: string;
  operation: OutboxOperation;
  payloadJson: string;
  reportedAt: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: 'pending' | 'failed' | 'done';
};
