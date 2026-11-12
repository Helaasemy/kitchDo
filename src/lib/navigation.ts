import { router, type Href } from 'expo-router';

/** Editor screen (`[id]/index.tsx`). Distinct from the hub at `[id]/hub`. */
export function templateEditorHref(templateId: string): Href {
  return {
    pathname: '/(app)/(tabs)/templates/[id]',
    params: { id: templateId },
  };
}

/** First string from Expo Router search params (can be a string, array, or missing). */
export function routeParam(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return undefined;
  return raw;
}

/** Go back when history exists; otherwise replace to a safe screen. */
export function goBackOr(fallback: Href = '/(app)/(tabs)/today') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
