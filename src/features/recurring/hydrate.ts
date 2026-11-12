import { getCatalogSnapshot } from '@/features/catalog/CatalogProvider';
import { presetSignature } from '@/features/catalog/signature';
import type { CatalogPreset } from '@/features/catalog/types';
import { getLocalDb, getSyncMeta, setSyncMeta } from '@/lib/storage';
import {
  listLocalBackups,
  reassignLocalOnlyKitchen,
  restoreLocalBackup,
} from '@/lib/storage/localBackup';

import { effectiveAssignee } from '@/features/assignment';

import {
  getTemplateFrequencies,
  listRecurringTasks,
  saveTemplateFrequencies,
} from './api';
import { matchPresetForTemplate } from './matchCatalog';

const HYDRATE_KEY = 'recurring_hydrated';
const ONCE_BACKFILL_KEY = 'recurring_once_v8';

type RestoreOutcome = 'wrote' | 'none' | 'empty' | 'retry';

/**
 * Rebuild Today’s rows after a wipe. Prefers a local backup; otherwise copies
 * frequencies from matching library presets. One-off items land on Today too.
 */
export async function hydrateRecurringTasks(
  userId: string,
  kitchenId: string,
): Promise<void> {
  await reassignLocalOnlyKitchen(userId, kitchenId);
  if ((await getSyncMeta(userId, kitchenId, HYDRATE_KEY)) !== '1') {
    if ((await listRecurringTasks(userId, kitchenId)).length === 0) {
      const backup = (await listLocalBackups(userId)).find((row) => row.taskCount > 0);
      if (backup) {
        await restoreLocalBackup(userId, backup.id);
        await reassignLocalOnlyKitchen(userId, kitchenId);
      }
    }

    const outcome = await restoreFrequenciesFromCatalog(userId, kitchenId);
    if (outcome === 'retry') return;
    if (outcome !== 'empty') {
      await setSyncMeta(userId, kitchenId, HYDRATE_KEY, '1');
    }
  }
  await backfillOnceTasks(userId, kitchenId);
}

async function restoreFrequenciesFromCatalog(
  userId: string,
  kitchenId: string,
): Promise<RestoreOutcome> {
  let templates: { id: string; title: string; state: string }[];
  try {
    const { listTemplates } = await import('@/features/templates/api');
    templates = await listTemplates(kitchenId, { state: 'all' });
  } catch {
    return 'retry';
  }

  const live = templates.filter((row) => row.state === 'active' || row.state === 'draft');
  if (live.length === 0) return 'empty';

  const { getTemplate } = await import('@/features/templates/api');
  let wrote = false;
  for (const summary of live) {
    const existing = await getTemplateFrequencies(userId, kitchenId, summary.id);
    if (Object.keys(existing).length > 0) continue;

    let detail: Awaited<ReturnType<typeof getTemplate>>;
    try {
      detail = await getTemplate(summary.id);
    } catch {
      return 'retry';
    }
    if (!detail || detail.items.length === 0) continue;

    const preset = matchPresetForTemplate(getCatalogSnapshot().presets, detail);
    const sectionFreqs = preset?.sections.flatMap((section) =>
      section.tasks.map(() => section.frequency ?? preset.frequency),
    );
    if (!preset || !sectionFreqs?.some(Boolean)) continue;

    const sectionTitles = new Map(detail.sections.map((s) => [s.id, s.title]));
    await saveTemplateFrequencies({
      userId,
      kitchenId,
      templateId: detail.id,
      templateTitle: detail.title,
      tasks: detail.items.map((item, index) => ({
        itemId: item.id,
        frequency: sectionFreqs[index] ?? preset.frequency,
        title: item.title,
        sectionTitle: item.sectionId ? (sectionTitles.get(item.sectionId) ?? null) : null,
        sortOrder: item.sortOrder,
        assigneeUserId: effectiveAssignee(detail.assigneeUserId, item.assignment),
      })),
    });
    await rememberSource(userId, kitchenId, detail.id, preset);
    wrote = true;
  }
  return wrote ? 'wrote' : 'none';
}

/** Existing lists only stored repeating tasks; missing items become one-offs on Today. */
async function backfillOnceTasks(userId: string, kitchenId: string): Promise<void> {
  if ((await getSyncMeta(userId, kitchenId, ONCE_BACKFILL_KEY)) === '1') return;

  let templates: { id: string; title: string; state: string }[];
  try {
    const { listTemplates } = await import('@/features/templates/api');
    templates = await listTemplates(kitchenId, { state: 'all' });
  } catch {
    return;
  }

  const live = templates.filter((row) => row.state === 'active' || row.state === 'draft');
  if (live.length === 0) return;

  const { getTemplate } = await import('@/features/templates/api');
  for (const summary of live) {
    let detail: Awaited<ReturnType<typeof getTemplate>>;
    try {
      detail = await getTemplate(summary.id);
    } catch {
      return;
    }
    if (!detail || detail.items.length === 0) continue;

    const existing = await getTemplateFrequencies(userId, kitchenId, summary.id);
    const missing = detail.items.some((item) => !existing[item.id]);
    if (!missing) continue;

    const sectionTitles = new Map(detail.sections.map((s) => [s.id, s.title]));
    await saveTemplateFrequencies({
      userId,
      kitchenId,
      templateId: detail.id,
      templateTitle: detail.title,
      tasks: detail.items.map((item) => ({
        itemId: item.id,
        frequency: existing[item.id] ?? 'once',
        title: item.title,
        sectionTitle: item.sectionId ? (sectionTitles.get(item.sectionId) ?? null) : null,
        sortOrder: item.sortOrder,
        assigneeUserId: effectiveAssignee(detail.assigneeUserId, item.assignment),
      })),
    });
  }

  await setSyncMeta(userId, kitchenId, ONCE_BACKFILL_KEY, '1');
}

async function rememberSource(
  userId: string,
  kitchenId: string,
  templateId: string,
  preset: CatalogPreset,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO local_template_sources (
      user_id, kitchen_id, template_id, preset_id, preset_signature, modified, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
    userId,
    kitchenId,
    templateId,
    preset.id,
    presetSignature(preset),
    new Date().toISOString(),
  );
}
