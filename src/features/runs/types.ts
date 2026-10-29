import type { RunItemOutcome } from '@/domain/runProgress';

export type RunSummary = {
  id: string;
  title: string;
  localDate: string;
  dueLabel: string;
  scheduledFor: string;
  dueAt: string | null;
  progressDone: number;
  progressTotal: number;
  blocked: number;
  state: string;
  urgency: boolean;
  categoryName: string | null;
  occurrenceKey: string;
  source: string;
};

export type RunItemView = {
  id: string;
  title: string;
  instructions: string | null;
  sectionTitle: string | null;
  sectionOrder: number | null;
  sortOrder: number;
  outcome: RunItemOutcome | string;
  note: string | null;
  revision: number;
  recordedAt: string | null;
  issueId: string | null;
  issueRevision: number | null;
  issueState: string | null;
};

export type RunDetail = {
  id: string;
  title: string;
  localDate: string;
  timezone: string;
  scheduledFor: string;
  dueAt: string | null;
  state: string;
  revision: number;
  source: string;
  occurrenceKey: string;
  categoryName: string | null;
  pendingCreate: boolean;
  items: RunItemView[];
  done: number;
  notApplicable: number;
  blocked: number;
  pending: number;
};
