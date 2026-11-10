import type { CatalogPreset } from './types';

type SignatureItem = { section: string | null; title: string; frequency: string | null };

function signatureOf(title: string, items: SignatureItem[]): string {
  return JSON.stringify([
    title.trim(),
    items.map((i) => [i.section?.trim() || null, i.title.trim(), i.frequency]),
  ]);
}

/** What a library copy looks like before anyone edits it. */
export function presetSignature(preset: CatalogPreset): string {
  return signatureOf(
    preset.title,
    preset.sections.flatMap((s) =>
      s.tasks.map((task) => ({
        section: s.title,
        title: task,
        frequency: s.frequency ?? preset.frequency,
      })),
    ),
  );
}

/** The same shape for a saved template, so an unedited copy compares equal. */
export function templateSignature(input: {
  title: string;
  sections: { id: string; title: string }[];
  items: { sectionId: string | null; title: string; frequency: string | null }[];
}): string {
  const sectionTitles = new Map(input.sections.map((s) => [s.id, s.title]));
  return signatureOf(
    input.title,
    input.items.map((i) => ({
      section: i.sectionId ? (sectionTitles.get(i.sectionId) ?? null) : null,
      title: i.title,
      frequency: i.frequency,
    })),
  );
}
