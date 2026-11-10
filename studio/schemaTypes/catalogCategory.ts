import { defineField, defineType } from 'sanity';

export const catalogCategory = defineType({
  name: 'catalogCategory',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({
      name: 'key',
      type: 'string',
      options: { list: ['home', 'kitchen'] },
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
      name: 'guidance',
      type: 'localeText',
    }),
    defineField({
      name: 'featured',
      title: 'Featured templates',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'catalogPreset' }] }],
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
