import { saveTemplateFrequencies } from '@/features/recurring/api';
import { publishTemplate, saveTemplateDraft } from '@/features/templates/api';
import { newId } from '@/lib/ids';
import { getLocalDb } from '@/lib/storage';

import { presetSignature } from './signature';
import type { CatalogPreset } from './types';

/**
 * Library copies are remembered on this device so the library can tell an
 * unedited copy (Use disabled) from one the user has changed or archived.
 */
export async function addPresetToTemplates(input: {
  userId: string;
  kitchenId: string;
  preset: CatalogPreset;
}): Promise<{ templateId: string }> {
  const { userId, kitchenId, preset } = input;
  const templateId = newId();
  const sections: { id: string; title: string; sort_order: number }[] = [];
  const items: {
    id: string;
    section_id: string | null;
    title: string;
    instructions: string | null;
    sort_order: number;
  }[] = [];
  for (const section of preset.sections) {
    let sectionId: string | null = null;
    if (section.title) {
      sectionId = newId();
      sections.push({ id: sectionId, title: section.title, sort_order: sections.length });
    }
    for (const task of section.tasks) {
      items.push({
        id: newId(),
        section_id: sectionId,
        title: task,
        instructions: null,
        sort_order: items.length,
      });
    }
  }
  const description = preset.notes
    .map((note) =>
      [note.text, ...note.links.map((l) => `${l.label}: ${l.url}`)]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');

  const draft = await saveTemplateDraft({
    templateId,
    kitchenId,
    expectedRevision: 0,
    title: preset.title,
    description: description || null,
    sections,
    items,
  });
  await publishTemplate({ templateId, expectedRevision: draft.revision });

  const sectionTitles = new Map(sections.map((s) => [s.id, s.title]));
  await saveTemplateFrequencies({
    userId,
    kitchenId,
    templateId,
    templateTitle: preset.title,
    tasks: items.map((i) => ({
      itemId: i.id,
      frequency: preset.frequency,
      title: i.title,
      sectionTitle: i.section_id ? (sectionTitles.get(i.section_id) ?? null) : null,
      sortOrder: i.sort_order,
    })),
  });

  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO local_template_sources (
      user_id, kitchen_id, template_id, preset_id, preset_signature, modified, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
    userId,
    kitchenId,
    templateId,
    preset.id,
    presetSignature(preset),
    new Date().toISOString(),
  );
  return { templateId };
}

/** An unedited copy of this preset, if one is still in the user's templates. */
export async function findUneditedCopy(
  userId: string,
  kitchenId: string,
  presetId: string,
): Promise<{ templateId: string } | null> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<{ template_id: string }>(
    `SELECT template_id FROM local_template_sources
     WHERE user_id = ? AND kitchen_id = ? AND preset_id = ? AND modified = 0
     ORDER BY created_at DESC LIMIT 1`,
    userId,
    kitchenId,
    presetId,
  );
  return row ? { templateId: row.template_id } : null;
}

export async function isLibraryCopy(
  userId: string,
  kitchenId: string,
  templateId: string,
): Promise<boolean> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<{ template_id: string }>(
    `SELECT template_id FROM local_template_sources
     WHERE user_id = ? AND kitchen_id = ? AND template_id = ?`,
    userId,
    kitchenId,
    templateId,
  );
  return Boolean(row);
}

/** After an editor save: a copy that no longer matches its preset counts as modified. */
export async function noteTemplateSaved(
  userId: string,
  kitchenId: string,
  templateId: string,
  signature: string,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `UPDATE local_template_sources
     SET modified = CASE WHEN preset_signature = ? THEN 0 ELSE 1 END
     WHERE user_id = ? AND kitchen_id = ? AND template_id = ?`,
    signature,
    userId,
    kitchenId,
    templateId,
  );
}

/** Archived copies no longer block using the preset again. */
export async function forgetTemplateSource(
  userId: string,
  kitchenId: string,
  templateId: string,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `DELETE FROM local_template_sources
     WHERE user_id = ? AND kitchen_id = ? AND template_id = ?`,
    userId,
    kitchenId,
    templateId,
  );
}
