import { router, type Href } from 'expo-router';

/** Go back when history exists; otherwise replace to a safe screen. */
export function goBackOr(fallback: Href = '/(app)/(tabs)/today') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
