import type { KitchenMode } from '@/i18n';
import { newId } from '@/lib/ids';
import { getDeviceTimeZone } from '@/lib/dates';
import { getSupabase, rpcErrorMessage } from '@/lib/supabase';
import {
  saveOnboardingState,
  type OnboardingDraft,
} from '@/features/auth/onboardingStore';

export type CompleteOnboardingInput = {
  userId: string;
  mode: KitchenMode;
  displayName: string;
  kitchenName: string;
};

type CompleteOnboardingResult = {
  user_id?: string;
  kitchen_id?: string;
};

/**
 * Atomically upsert profile + primary kitchen via `complete_onboarding`.
 * Caches a local draft so cold starts stay snappy before the next profile fetch.
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput,
): Promise<OnboardingDraft> {
  const kitchenId = newId();
  // Device TZ is auto-detected for later scheduling — not a user picker.
  void getDeviceTimeZone();

  const { data, error } = await getSupabase().rpc('complete_onboarding', {
    p_display_name: input.displayName.trim(),
    p_kitchen_name: input.kitchenName.trim(),
    p_kitchen_kind: input.mode,
    p_kitchen_id: kitchenId,
  });

  if (error) throw new Error(rpcErrorMessage(error, 'Onboarding failed.'));

  const result = (data ?? {}) as CompleteOnboardingResult;
  const resolvedKitchenId = result.kitchen_id ?? kitchenId;

  const draft: OnboardingDraft = {
    completed: true,
    mode: input.mode,
    displayName: input.displayName.trim(),
    kitchenName: input.kitchenName.trim(),
    kitchenId: resolvedKitchenId,
  };

  await saveOnboardingState(input.userId, draft);
  return draft;
}
