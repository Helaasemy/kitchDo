import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';

import { schemaTypes } from './schemaTypes';
import { deskStructure } from './structure';

export default defineConfig({
  name: 'kitchdo',
  title: 'KitchDo Library',
  projectId: 'qxq0r1rb',
  dataset: 'production',
  plugins: [structureTool({ structure: deskStructure })],
  schema: {
    types: schemaTypes,
  },
});
