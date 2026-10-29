import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useAuth } from '@/features/auth';

import { openRunForOccurrence } from './api';

function occurrenceFromResponse(
  response: Notifications.NotificationResponse | null,
): { occurrenceKey: string; kitchenId?: string } | null {
  if (!response) return null;
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  const occurrenceKey = data?.occurrenceKey;
  if (typeof occurrenceKey !== 'string' || !occurrenceKey.trim()) return null;
  const kitchenId =
    typeof data?.kitchenId === 'string' ? data.kitchenId : undefined;
  return { occurrenceKey, kitchenId };
}

/**
 * Cold-start + foreground handling for local reminder taps.
 * Navigates to the matching run after ensuring the occurrence exists.
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

    async function open(
      payload: { occurrenceKey: string; kitchenId?: string },
      responseId: string,
    ) {
      if (handled.current === responseId) return;
      handled.current = responseId;
      const targetKitchen = payload.kitchenId ?? kitchenId;
      if (targetKitchen !== kitchenId) return;

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
      const payload = occurrenceFromResponse(last);
      if (!payload || !last) return;
      void open(payload, last.notification.request.identifier);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const payload = occurrenceFromResponse(response);
        if (!payload) return;
        void open(payload, response.notification.request.identifier);
      },
    );

    return () => {
      sub.remove();
    };
  }, [status, user?.id, onboarding?.kitchenId]);

  return null;
}
