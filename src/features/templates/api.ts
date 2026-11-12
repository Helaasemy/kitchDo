import { parseAssigneeMode, type ItemAssignment } from '@/features/assignment';
import { newId } from '@/lib/ids';
import { getSupabase, isMissingColumnError, rpcErrorMessage } from '@/lib/supabase';
import type { Json } from '@/types/database';

export type TemplateState = 'draft' | 'active' | 'archived';

export type TemplateSummary = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  state: TemplateState;
  revision: number;
  publishedRevision: number | null;
  updatedAt: string;
};

export type TemplateSectionInput = {
  id: string;
  title: string;
  sort_order: number;
};

export type TemplateItemInput = {
  id: string;
  section_id: string | null;
  title: string;
  instructions: string | null;
  sort_order: number;
  assignee_user_id?: string | null;
  assignee_mode?: ItemAssignment['mode'];
};

export type TemplateDetail = TemplateSummary & {
  kitchenId: string;
  assigneeUserId: string | null;
  sections: {
    id: string;
    title: string;
    sortOrder: number;
  }[];
  items: {
    id: string;
    sectionId: string | null;
    title: string;
    instructions: string | null;
    sortOrder: number;
    assignment: ItemAssignment;
  }[];
};

function asState(value: string): TemplateState {
  if (value === 'active' || value === 'archived') return value;
  return 'draft';
}

function mapSummary(row: {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  state: string;
  revision: number;
  published_revision: number | null;
  updated_at: string;
}): TemplateSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    state: asState(row.state),
    revision: row.revision,
    publishedRevision: row.published_revision,
    updatedAt: row.updated_at,
  };
}

export async function listTemplates(
  kitchenId: string,
  opts?: {
    state?: TemplateState | 'all';
    categoryId?: string | null | 'uncategorized';
    search?: string;
  },
): Promise<TemplateSummary[]> {
  let query = getSupabase()
    .from('kdo_templates')
    .select(
      'id, title, description, category_id, state, revision, published_revision, updated_at',
    )
    .eq('kitchen_id', kitchenId)
    .order('updated_at', { ascending: false });

  if (opts?.state && opts.state !== 'all') {
    query = query.eq('state', opts.state);
  }

  if (opts?.categoryId === 'uncategorized') {
    query = query.is('category_id', null);
  } else if (opts?.categoryId) {
    query = query.eq('category_id', opts.categoryId);
  }

  const search = opts?.search?.trim();
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(rpcErrorMessage(error, 'Could not load templates.'));
  return (data ?? []).map(mapSummary);
}

const TEMPLATE_SELECT =
  'id, kitchen_id, title, description, category_id, state, revision, published_revision, updated_at, assignee_user_id';
const TEMPLATE_SELECT_LEGACY =
  'id, kitchen_id, title, description, category_id, state, revision, published_revision, updated_at';
const ITEM_SELECT =
  'id, section_id, title, instructions, sort_order, assignee_user_id, assignee_mode';
const ITEM_SELECT_LEGACY = 'id, section_id, title, instructions, sort_order';

export async function getTemplate(templateId: string): Promise<TemplateDetail | null> {
  const supabase = getSupabase();

  let { data: row, error } = await supabase
    .from('kdo_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', templateId)
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    const fallback = await supabase
      .from('kdo_templates')
      .select(TEMPLATE_SELECT_LEGACY)
      .eq('id', templateId)
      .maybeSingle();
    row = fallback.data
      ? { ...fallback.data, assignee_user_id: null }
      : null;
    error = fallback.error;
  }

  if (error) throw new Error(rpcErrorMessage(error, 'Could not load template.'));
  if (!row) return null;

  const sectionsQuery = supabase
    .from('kdo_template_sections')
    .select('id, title, sort_order')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });

  const itemsQuery = supabase
    .from('kdo_template_items')
    .select(ITEM_SELECT)
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });

  const [{ data: sections, error: secErr }, itemsResult] = await Promise.all([
    sectionsQuery,
    itemsQuery,
  ]);

  let itemRows = itemsResult.data;
  let itemErr = itemsResult.error;
  if (itemErr && isMissingColumnError(itemErr)) {
    const fallback = await supabase
      .from('kdo_template_items')
      .select(ITEM_SELECT_LEGACY)
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });
    itemErr = fallback.error;
    itemRows = (fallback.data ?? []).map((item) => ({
      ...item,
      assignee_user_id: null,
      assignee_mode: 'inherit',
    }));
  }

  if (secErr) throw new Error(rpcErrorMessage(secErr, 'Could not load sections.'));
  if (itemErr) throw new Error(rpcErrorMessage(itemErr, 'Could not load items.'));

  return {
    ...mapSummary(row),
    kitchenId: row.kitchen_id,
    assigneeUserId: row.assignee_user_id,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sort_order,
    })),
    items: (itemRows ?? []).map((i) => ({
      id: i.id,
      sectionId: i.section_id,
      title: i.title,
      instructions: i.instructions,
      sortOrder: i.sort_order,
      assignment: {
        mode: parseAssigneeMode(i.assignee_mode),
        userId: i.assignee_user_id,
      },
    })),
  };
}

export async function saveTemplateDraft(input: {
  mutationId?: string;
  templateId: string;
  kitchenId: string;
  expectedRevision: number;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  assigneeUserId?: string | null;
  sections: TemplateSectionInput[];
  items: TemplateItemInput[];
}): Promise<{ templateId: string; revision: number }> {
  const title = input.title.trim();
  if (!title) throw new Error('Title is required.');

  const description = input.description?.trim();
  const { data, error } = await getSupabase().rpc('save_template_draft', {
    p_mutation_id: input.mutationId ?? newId(),
    p_template_id: input.templateId,
    p_kitchen_id: input.kitchenId,
    p_expected_revision: input.expectedRevision,
    p_title: title,
    ...(description ? { p_description: description } : {}),
    ...(input.categoryId ? { p_category_id: input.categoryId } : {}),
    p_sections: input.sections as unknown as Json,
    p_items: input.items as unknown as Json,
    p_assignee_user_id: input.assigneeUserId ?? null,
  });

  if (error) throw new Error(rpcErrorMessage(error, 'Could not save draft.'));

  const result = (data ?? {}) as { template_id?: string; revision?: number };
  return {
    templateId: result.template_id ?? input.templateId,
    revision: result.revision ?? input.expectedRevision + 1,
  };
}

export async function saveTemplateAssignments(input: {
  mutationId?: string;
  templateId: string;
  kitchenId: string;
  expectedRevision: number;
  assigneeUserId: string | null;
  items?: { id: string; assignee_mode: ItemAssignment['mode']; assignee_user_id: string | null }[];
}): Promise<{ templateId: string; revision: number }> {
  const { data, error } = await getSupabase().rpc('save_template_assignments', {
    p_mutation_id: input.mutationId ?? newId(),
    p_template_id: input.templateId,
    p_kitchen_id: input.kitchenId,
    p_expected_revision: input.expectedRevision,
    p_assignee_user_id: input.assigneeUserId,
    p_items: (input.items ?? []) as unknown as Json,
  });

  if (error) throw new Error(rpcErrorMessage(error, 'Could not save assignment.'));

  const result = (data ?? {}) as { template_id?: string; revision?: number };
  return {
    templateId: result.template_id ?? input.templateId,
    revision: result.revision ?? input.expectedRevision + 1,
  };
}

export async function publishTemplate(input: {
  templateId: string;
  expectedRevision: number;
}): Promise<{
  templateId: string;
  revision: number;
  publishedRevision: number;
  templateRevisionId: string;
}> {
  const { data, error } = await getSupabase().rpc('publish_template', {
    p_mutation_id: newId(),
    p_template_id: input.templateId,
    p_expected_revision: input.expectedRevision,
  });

  if (error) throw new Error(rpcErrorMessage(error, 'Could not publish template.'));

  const result = (data ?? {}) as {
    template_id?: string;
    revision?: number;
    published_revision?: number;
    template_revision_id?: string;
  };

  return {
    templateId: result.template_id ?? input.templateId,
    revision: result.revision ?? input.expectedRevision + 1,
    publishedRevision: result.published_revision ?? 1,
    templateRevisionId: result.template_revision_id ?? '',
  };
}

export async function duplicateTemplate(
  templateId: string,
): Promise<{ templateId: string; revision: number }> {
  const newTemplateId = newId();
  const { data, error } = await getSupabase().rpc('duplicate_template', {
    p_mutation_id: newId(),
    p_template_id: templateId,
    p_new_template_id: newTemplateId,
  });

  if (error) throw new Error(rpcErrorMessage(error, 'Could not duplicate template.'));

  const result = (data ?? {}) as { template_id?: string; revision?: number };
  return {
    templateId: result.template_id ?? newTemplateId,
    revision: result.revision ?? 1,
  };
}

export async function archiveTemplate(input: {
  templateId: string;
  expectedRevision: number;
}): Promise<void> {
  const { error } = await getSupabase().rpc('archive_template', {
    p_mutation_id: newId(),
    p_template_id: input.templateId,
    p_expected_revision: input.expectedRevision,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not archive template.'));
}

export async function latestPublishedRevisionId(
  templateId: string,
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('kdo_template_revisions')
    .select('id')
    .eq('template_id', templateId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(rpcErrorMessage(error, 'Could not find published revision.'));
  return data?.id ?? null;
}

/** Kitchen-wide list + item assignment, for overlaying onto Today. */
export async function listKitchenAssignments(kitchenId: string): Promise<{
  templates: Record<string, string | null>;
  items: Record<string, ItemAssignment>;
}> {
  const supabase = getSupabase();
  const [{ data: templates, error: tErr }, { data: items, error: iErr }] =
    await Promise.all([
      supabase
        .from('kdo_templates')
        .select('id, assignee_user_id')
        .eq('kitchen_id', kitchenId),
      supabase
        .from('kdo_template_items')
        .select('id, assignee_user_id, assignee_mode')
        .eq('kitchen_id', kitchenId),
    ]);
  if (tErr && !isMissingColumnError(tErr)) {
    throw new Error(rpcErrorMessage(tErr, 'Could not load assignments.'));
  }
  if (iErr && !isMissingColumnError(iErr)) {
    throw new Error(rpcErrorMessage(iErr, 'Could not load assignments.'));
  }

  const templateMap: Record<string, string | null> = {};
  for (const row of templates ?? []) {
    templateMap[row.id] = row.assignee_user_id;
  }
  const itemMap: Record<string, ItemAssignment> = {};
  for (const row of items ?? []) {
    itemMap[row.id] = {
      mode: parseAssigneeMode(row.assignee_mode),
      userId: row.assignee_user_id,
    };
  }
  return { templates: templateMap, items: itemMap };
}

/** Split pasted text into candidate checklist item titles. */
export function parsePastedItems(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);
}
