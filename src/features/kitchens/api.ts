import type { KitchenMode } from '@/i18n';
import {
  saveOnboardingState,
  type OnboardingDraft,
} from '@/features/auth/onboardingStore';
import { listMemberships } from '@/features/membership';
import { getSupabase, rpcErrorMessage } from '@/lib/supabase';

export type Kitchen = {
  id: string;
  name: string;
  mode: KitchenMode;
  ownerUserId: string;
  revision: number;
};

export type Profile = {
  userId: string;
  displayName: string;
  locale: string | null;
};

function asMode(kind: string): KitchenMode {
  return kind === 'business' ? 'business' : 'home';
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('kdo_profiles')
    .select('user_id, display_name, locale')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(rpcErrorMessage(error, 'Could not load profile.'));
  if (!data) return null;
  return {
    userId: data.user_id,
    displayName: data.display_name,
    locale: data.locale,
  };
}

/** Kitchens the user belongs to (any role), oldest membership first. */
export async function listOwnedKitchens(userId: string): Promise<Kitchen[]> {
  const memberships = await listMemberships(userId);
  return memberships.map((k) => ({
    id: k.kitchenId,
    name: k.name,
    mode: k.mode,
    ownerUserId: k.ownerUserId,
    revision: k.revision,
  }));
}

export async function fetchPrimaryKitchen(
  userId: string,
): Promise<Kitchen | null> {
  const memberships = await listMemberships(userId);
  const kitchen = memberships[0];
  if (!kitchen) return null;
  return {
    id: kitchen.kitchenId,
    name: kitchen.name,
    mode: kitchen.mode,
    ownerUserId: kitchen.ownerUserId,
    revision: kitchen.revision,
  };
}

/** Server source of truth for whether onboarding is done. */
export async function resolveSessionBootstrap(
  userId: string,
): Promise<OnboardingDraft | null> {
  const [profile, kitchen] = await Promise.all([
    fetchProfile(userId),
    fetchPrimaryKitchen(userId),
  ]);

  if (!profile || !kitchen) return null;

  const draft: OnboardingDraft = {
    completed: true,
    mode: kitchen.mode,
    displayName: profile.displayName,
    kitchenName: kitchen.name,
    kitchenId: kitchen.id,
    kitchenRevision: kitchen.revision,
  };

  await saveOnboardingState(userId, draft);
  return draft;
}

export async function updateProfileDisplayName(
  userId: string,
  displayName: string,
): Promise<void> {
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error('Enter a name.');
  const { error } = await getSupabase()
    .from('kdo_profiles')
    .update({ display_name: trimmed })
    .eq('user_id', userId);
  if (error) throw new Error(rpcErrorMessage(error));
}

export async function updateKitchen(
  kitchenId: string,
  input: { name?: string; kind?: KitchenMode; expectedRevision: number },
): Promise<Kitchen> {
  const patch: { name?: string; kind?: string; revision: number } = {
    revision: input.expectedRevision + 1,
  };
  if (input.name != null) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error('Enter a kitchen name.');
    patch.name = trimmed;
  }
  if (input.kind != null) patch.kind = input.kind;

  const { data, error } = await getSupabase()
    .from('kdo_kitchens')
    .update(patch)
    .eq('id', kitchenId)
    .eq('revision', input.expectedRevision)
    .select('id, name, kind, owner_user_id, revision')
    .maybeSingle();
  if (error) throw new Error(rpcErrorMessage(error));
  if (!data) throw new Error('Kitchen was updated elsewhere. Refresh and try again.');
  return {
    id: data.id,
    name: data.name,
    mode: asMode(data.kind),
    ownerUserId: data.owner_user_id,
    revision: data.revision,
  };
}

export { rpcErrorMessage };
