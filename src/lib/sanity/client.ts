import { createClient, type SanityClient } from '@sanity/client';

export function sanityConfig(): {
  projectId: string;
  dataset: string;
  apiVersion: string;
} | null {
  const projectId = process.env.EXPO_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.EXPO_PUBLIC_SANITY_DATASET?.trim();
  const apiVersion =
    process.env.EXPO_PUBLIC_SANITY_API_VERSION?.trim() || '2025-02-19';
  if (!projectId || !dataset) return null;
  return { projectId, dataset, apiVersion };
}

let cached: SanityClient | null | undefined;

export function getSanityClient(): SanityClient | null {
  if (cached !== undefined) return cached;
  const config = sanityConfig();
  cached = config
    ? createClient({
        ...config,
        useCdn: true,
        perspective: 'published',
      })
    : null;
  return cached;
}
