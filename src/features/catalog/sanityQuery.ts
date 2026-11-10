const loc = (field: string) =>
  `coalesce(${field}[$locale], ${field}.en, ${field})`;

const locItem = `coalesce(@[$locale], @.en, @)`;

/** Published catalog tree. Field names match `Catalog` after mapping. */
export const CATALOG_GROQ = `{
  "categories": *[_type == "catalogCategory"] | order(sortOrder asc) {
    key,
    "label": ${loc('label')},
    icon,
    "guidance": ${loc('guidance')},
    "featured": featured[]->stableId,
    "groups": *[_type == "catalogGroup" && category._ref == ^._id] | order(sortOrder asc) {
      key,
      "label": ${loc('label')},
      icon,
      "presetIds": *[_type == "catalogPreset" && group._ref == ^._id] | order(sortOrder asc).stableId
    }
  },
  "presets": *[_type == "catalogPreset"] | order(stableId asc) {
    "id": stableId,
    "category": category->key,
    "group": group->key,
    "title": ${loc('title')},
    "cadence": ${loc('cadence')},
    "searchTerms": searchTerms[]{ "text": ${locItem} }.text,
    "aliases": aliases[]{ "text": ${locItem} }.text,
    sections[] {
      "title": ${loc('title')},
      frequency,
      "tasks": tasks[]{ "text": ${locItem} }.text
    },
    notes[] {
      "text": ${loc('text')},
      links[] { "label": ${loc('label')}, url }
    }
  }
}`;
