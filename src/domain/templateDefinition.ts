import { z } from 'zod';

/** Published revision definition shape from `kdo_build_template_definition`. */
export const templateDefinitionSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  category_id: z.union([z.string(), z.null()]).optional(),
  category_name: z.string().nullable().optional(),
  assignee_user_id: z.union([z.string(), z.null()]).optional(),
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        sort_order: z.number().int(),
      }),
    )
    .optional()
    .default([]),
  items: z
    .array(
      z.object({
        id: z.string(),
        section_id: z.union([z.string(), z.null()]).optional(),
        title: z.string(),
        instructions: z.string().nullable().optional(),
        response_type: z.string().optional().default('checkbox'),
        sort_order: z.number().int(),
        assignee_user_id: z.union([z.string(), z.null()]).optional(),
        assignee_mode: z.enum(['inherit', 'explicit']).optional(),
      }),
    )
    .min(1),
});

export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;

export function parseTemplateDefinition(raw: unknown): TemplateDefinition {
  return templateDefinitionSchema.parse(raw);
}

export type MaterializedItem = {
  sourceItemId: string;
  sourceSectionId: string | null;
  sectionTitle: string | null;
  sectionOrder: number | null;
  title: string;
  instructions: string | null;
  responseType: string;
  sortOrder: number;
};

export function materializeItemsFromDefinition(
  definition: TemplateDefinition,
): MaterializedItem[] {
  const sectionById = new Map(
    definition.sections.map((s) => [s.id, s] as const),
  );
  const items = [...definition.items].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );

  return items.map((item, index) => {
    const section = item.section_id
      ? (sectionById.get(item.section_id) ?? null)
      : null;
    return {
      sourceItemId: item.id,
      sourceSectionId: item.section_id ?? null,
      sectionTitle: section?.title ?? null,
      sectionOrder: section?.sort_order ?? null,
      title: item.title,
      instructions: item.instructions ?? null,
      responseType: item.response_type || 'checkbox',
      sortOrder: item.sort_order ?? index,
    };
  });
}
