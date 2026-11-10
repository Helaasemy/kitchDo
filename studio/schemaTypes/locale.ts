import { defineField, defineType } from 'sanity';

/** Matches `APP_LOCALES` in the Expo app. English is the source; others are optional. */
export const LOCALES = [
  { id: 'en', title: 'English' },
  { id: 'fr', title: 'Français' },
  { id: 'es', title: 'Español' },
  { id: 'pt', title: 'Português (Brasil)' },
  { id: 'de', title: 'Deutsch' },
  { id: 'it', title: 'Italiano' },
  { id: 'id', title: 'Bahasa Indonesia' },
  { id: 'tr', title: 'Türkçe' },
  { id: 'zh', title: '中文' },
  { id: 'ja', title: '日本語' },
  { id: 'ko', title: '한국어' },
  { id: 'ar', title: 'العربية' },
] as const;

const translationFields = LOCALES.filter((locale) => locale.id !== 'en').map((locale) =>
  defineField({
    name: locale.id,
    title: locale.title,
    type: 'string',
    fieldset: 'translations',
  }),
);

const translationTextFields = LOCALES.filter((locale) => locale.id !== 'en').map((locale) =>
  defineField({
    name: locale.id,
    title: locale.title,
    type: 'text',
    fieldset: 'translations',
  }),
);

const localeFieldsets = [
  {
    name: 'translations',
    title: 'Translations',
    options: { collapsible: true, collapsed: true },
  },
];

export const localeString = defineType({
  name: 'localeString',
  title: 'Localized text',
  type: 'object',
  fieldsets: localeFieldsets,
  fields: [
    defineField({
      name: 'en',
      title: 'English',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    ...translationFields,
  ],
  preview: {
    select: { title: 'en' },
  },
});

export const localeText = defineType({
  name: 'localeText',
  title: 'Localized paragraph',
  type: 'object',
  fieldsets: localeFieldsets,
  fields: [
    defineField({
      name: 'en',
      title: 'English',
      type: 'text',
      validation: (rule) => rule.required(),
    }),
    ...translationTextFields,
  ],
  preview: {
    select: { title: 'en' },
  },
});
