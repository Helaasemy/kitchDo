import type { StructureResolver } from 'sanity/structure';

export const deskStructure: StructureResolver = (S) =>
  S.list()
    .title('Library')
    .items([
      S.listItem()
        .title('Templates')
        .schemaType('catalogPreset')
        .child(S.documentTypeList('catalogPreset').title('Templates')),
      S.listItem()
        .title('Groups')
        .schemaType('catalogGroup')
        .child(S.documentTypeList('catalogGroup').title('Groups')),
      S.listItem()
        .title('Categories')
        .schemaType('catalogCategory')
        .child(S.documentTypeList('catalogCategory').title('Categories')),
    ]);
