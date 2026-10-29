import { newId } from '@/lib/ids';
import { getSupabase, rpcErrorMessage } from '@/lib/supabase';
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
};

export type TemplateDetail = TemplateSummary & {
  kitchenId: string;
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

export async function getTemplate(templateId: string): Promise<TemplateDetail | null> {
  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from('kdo_templates')
    .select(
      'id, kitchen_id, title, description, category_id, state, revision, published_revision, updated_at',
    )
    .eq('id', templateId)
    .maybeSingle();

  if (error) throw new Error(rpcErrorMessage(error, 'Could not load template.'));
  if (!row) return null;

  const [{ data: sections, error: secErr }, { data: items, error: itemErr }] =
    await Promise.all([
      supabase
        .from('kdo_template_sections')
        .select('id, title, sort_order')
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('kdo_template_items')
        .select('id, section_id, title, instructions, sort_order')
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true }),
    ]);

  if (secErr) throw new Error(rpcErrorMessage(secErr, 'Could not load sections.'));
  if (itemErr) throw new Error(rpcErrorMessage(itemErr, 'Could not load items.'));

  return {
    ...mapSummary(row),
    kitchenId: row.kitchen_id,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sort_order,
    })),
    items: (items ?? []).map((i) => ({
      id: i.id,
      sectionId: i.section_id,
      title: i.title,
      instructions: i.instructions,
      sortOrder: i.sort_order,
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
  });

  if (error) throw new Error(rpcErrorMessage(error, 'Could not save draft.'));

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

/** Split pasted text into candidate checklist item titles. */
export function parsePastedItems(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);
}
