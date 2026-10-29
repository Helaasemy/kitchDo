import type { KitchenMode } from '@/i18n';
import { newId } from '@/lib/ids';
import { getSupabase, rpcErrorMessage } from '@/lib/supabase';

export type Category = {
  id: string;
  kitchenId: string;
  name: string;
  sortOrder: number;
  revision: number;
  archivedAt: string | null;
};

export const SUGGESTED_CATEGORIES: Record<KitchenMode, readonly string[]> = {
  home: ['Morning reset', 'Evening reset', 'Groceries', 'Cleaning'],
  business: ['Opening', 'Closing', 'Prep', 'Service', 'Deep clean'],
};

function mapRow(row: {
  id: string;
  kitchen_id: string;
  name: string;
  sort_order: number;
  revision: number;
  archived_at: string | null;
}): Category {
  return {
    id: row.id,
    kitchenId: row.kitchen_id,
    name: row.name,
    sortOrder: row.sort_order,
    revision: row.revision,
    archivedAt: row.archived_at,
  };
}

export async function listCategories(
  kitchenId: string,
  opts?: { includeArchived?: boolean },
): Promise<Category[]> {
  let query = getSupabase()
    .from('kdo_categories')
    .select('id, kitchen_id, name, sort_order, revision, archived_at')
    .eq('kitchen_id', kitchenId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!opts?.includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(rpcErrorMessage(error, 'Could not load categories.'));
  return (data ?? []).map(mapRow);
}

export async function createCategory(input: {
  kitchenId: string;
  ownerUserId: string;
  name: string;
  sortOrder?: number;
}): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required.');

  const id = newId();
  let sortOrder = input.sortOrder;
  if (sortOrder == null) {
    const existing = await listCategories(input.kitchenId);
    sortOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((c) => c.sortOrder)) + 1;
  }

  const { data, error } = await getSupabase()
    .from('kdo_categories')
    .insert({
      id,
      kitchen_id: input.kitchenId,
      owner_user_id: input.ownerUserId,
      name,
      sort_order: sortOrder,
    })
    .select('id, kitchen_id, name, sort_order, revision, archived_at')
    .single();

  if (error) throw new Error(rpcErrorMessage(error, 'Could not create category.'));
  return mapRow(data);
}

export async function renameCategory(input: {
  categoryId: string;
  name: string;
  expectedRevision: number;
}): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required.');

  const { data, error } = await getSupabase()
    .from('kdo_categories')
    .update({
      name,
      revision: input.expectedRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.categoryId)
    .eq('revision', input.expectedRevision)
    .is('archived_at', null)
    .select('id, kitchen_id, name, sort_order, revision, archived_at')
    .maybeSingle();

  if (error) throw new Error(rpcErrorMessage(error, 'Could not rename category.'));
  if (!data) throw new Error('Category was updated elsewhere. Refresh and try again.');
  return mapRow(data);
}

export async function reorderCategories(
  ordered: { id: string; revision: number; sortOrder: number }[],
): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  for (const row of ordered) {
    const { error } = await supabase
      .from('kdo_categories')
      .update({
        sort_order: row.sortOrder,
        revision: row.revision + 1,
        updated_at: now,
      })
      .eq('id', row.id)
      .eq('revision', row.revision);

    if (error) {
      throw new Error(rpcErrorMessage(error, 'Could not reorder categories.'));
    }
  }
}

export async function archiveCategory(input: {
  categoryId: string;
  expectedRevision: number;
}): Promise<void> {
  const { error } = await getSupabase().rpc('archive_category', {
    p_mutation_id: newId(),
    p_category_id: input.categoryId,
    p_expected_revision: input.expectedRevision,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not archive category.'));
}

/** Create from a suggested chip if that name is not already active. */
export async function ensureSuggestedCategory(input: {
  kitchenId: string;
  ownerUserId: string;
  name: string;
}): Promise<Category> {
  const existing = await listCategories(input.kitchenId);
  const hit = existing.find(
    (c) => c.name.toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (hit) return hit;
  return createCategory(input);
}
