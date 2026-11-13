import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useAuth } from '@/features/auth';

import { openRunForOccurrence } from './api';

type NotificationNav =
  | { kind: 'assignment'; kitchenId?: string }
  | { kind: 'reminder'; occurrenceKey: string; kitchenId?: string };

function navFromResponse(
  response: Notifications.NotificationResponse | null,
): NotificationNav | null {
  if (!response) return null;
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  if (!data) return null;
  if (data.type === 'assignment') {
    return {
      kind: 'assignment',
      kitchenId: typeof data.kitchenId === 'string' ? data.kitchenId : undefined,
    };
  }
  const occurrenceKey = data.occurrenceKey;
  if (typeof occurrenceKey !== 'string' || !occurrenceKey.trim()) return null;
  return {
    kind: 'reminder',
    occurrenceKey,
    kitchenId: typeof data.kitchenId === 'string' ? data.kitchenId : undefined,
  };
}

/**
 * Cold-start + foreground handling for local reminder taps and assignment pushes.
 */
export function ReminderResponseBridge() {
  const { user, onboarding, status } = useAuth();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !user?.id || !onboarding?.kitchenId) {
      return;
    }

    const userId = user.id;
    const kitchenId = onboarding.kitchenId;

    async function open(payload: NotificationNav, responseId: string) {
      if (handled.current === responseId) return;
      handled.current = responseId;
      const targetKitchen = payload.kitchenId ?? kitchenId;
      if (targetKitchen !== kitchenId) return;

      if (payload.kind === 'assignment') {
        router.push('/(app)/(tabs)/today');
        return;
      }

      try {
        const runId = await openRunForOccurrence({
          userId,
          kitchenId,
          occurrenceKey: payload.occurrenceKey,
        });
        if (runId) {
          router.push(`/(app)/runs/${runId}`);
        } else {
          router.push('/(app)/(tabs)/today');
        }
      } catch {
        router.push('/(app)/(tabs)/today');
      }
    }

    void Notifications.getLastNotificationResponseAsync().then((last) => {
      const payload = navFromResponse(last);
      if (!payload || !last) return;
      void open(payload, last.notification.request.identifier);
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const payload = navFromResponse(response);
      if (!payload) return;
      void open(payload, response.notification.request.identifier);
    });

    return () => {
      sub.remove();
    };
  }, [status, user?.id, onboarding?.kitchenId]);

  return null;
}
