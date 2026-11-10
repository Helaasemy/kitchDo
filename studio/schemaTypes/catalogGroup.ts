import { defineField, defineType } from 'sanity';

export const catalogGroup = defineType({
  name: 'catalogGroup',
  title: 'Group',
  type: 'document',
  fields: [
    defineField({
      name: 'key',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'label',
      type: 'localeString',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'icon',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      type: 'reference',
      to: [{ type: 'catalogCategory' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sortOrder',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: 'label.en', subtitle: 'key' },
  },
});
