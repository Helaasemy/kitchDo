import { defineField, defineType } from 'sanity';

export const catalogPreset = defineType({
  name: 'catalogPreset',
  title: 'Template',
  type: 'document',
  fields: [
    defineField({
      name: 'stableId',
      title: 'ID',
      type: 'string',
      description: 'Stable app id, e.g. H02 or B02.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      type: 'localeString',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'cadence',
      type: 'localeString',
      description: 'Human timing label for search and preview, e.g. Weekly.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      type: 'reference',
      to: [{ type: 'catalogCategory' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'group',
      type: 'reference',
      to: [{ type: 'catalogGroup' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'searchTerms',
      type: 'array',
      of: [{ type: 'localeString' }],
    }),
    defineField({
      name: 'aliases',
      type: 'array',
      of: [{ type: 'localeString' }],
    }),
    defineField({
      name: 'sections',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', type: 'localeString' },
            {
              name: 'frequency',
              type: 'string',
              options: { list: ['daily', 'weekly', 'monthly'] },
              description: 'Starting repeat for every task in this section.',
            },
            {
              name: 'tasks',
              type: 'array',
              of: [{ type: 'localeString' }],
              validation: (rule) => rule.required().min(1),
            },
          ],
          preview: {
            select: { title: 'title.en', frequency: 'frequency', tasks: 'tasks' },
            prepare({ title, frequency, tasks }) {
              const count = Array.isArray(tasks) ? tasks.length : 0;
              return {
                title: title || 'Untitled section',
                subtitle: [frequency || 'one-off', `${count} tasks`].join(' · '),
              };
            },
          },
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'notes',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'text', type: 'localeText', validation: (rule) => rule.required() },
            {
              name: 'links',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    { name: 'label', type: 'localeString' },
                    { name: 'url', type: 'url' },
                  ],
                },
              ],
            },
          ],
          preview: {
            select: { title: 'text.en' },
          },
        },
      ],
    }),
    defineField({
      name: 'sortOrder',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: 'title.en', subtitle: 'stableId' },
  },
});
