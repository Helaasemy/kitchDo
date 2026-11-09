import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import type { KitchenMode } from '@/i18n';
import { cancelAllMappedReminders } from '@/lib/notifications';
import { clearAccountLocalData, countPendingOutbox } from '@/lib/storage';
import { tryReadSupabaseConfig } from '@/lib/supabase';
import { AUTH_CALLBACK_URL, getSupabase } from '@/lib/supabase/client';
import { completeOnboarding } from '@/features/onboarding/api';
import {
  fetchProfile,
  listOwnedKitchens,
} from '@/features/kitchens/api';
import {
  loadOnboardingState,
  saveOnboardingState,
  type OnboardingDraft,
} from './onboardingStore';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'needs_onboarding'
  | 'authenticated'
  | 'misconfigured';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  onboarding: OnboardingDraft | null;
  configError: string | null;
  kitchenMode: KitchenMode;
  kitchenId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: (opts?: {
    discardPending?: boolean;
  }) => Promise<{ error: string | null; pendingCount?: number }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  finishOnboarding: (input: {
    mode: KitchenMode;
    displayName: string;
    kitchenName: string;
  }) => Promise<{ error: string | null }>;
  refreshOnboarding: () => Promise<void>;
  setOnboardingDraft: (draft: OnboardingDraft) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveOnboarding(userId: string): Promise<OnboardingDraft | null> {
  const local = await loadOnboardingState(userId);

  try {
    const [profile, kitchens] = await Promise.all([
      fetchProfile(userId),
      listOwnedKitchens(userId),
    ]);
    const kitchen = kitchens[0] ?? null;
    if (profile && kitchen) {
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
    if (profile && !kitchen) {
      return {
        completed: false,
        mode: local?.mode ?? 'home',
        displayName: profile.displayName,
        kitchenName: local?.kitchenName ?? '',
      };
    }
  } catch {
    /* offline / misconfigured — fall back to local */
  }

  return local;
}

function onboardingEqual(
  a: OnboardingDraft | null,
  b: OnboardingDraft | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.completed === b.completed &&
    a.mode === b.mode &&
    a.displayName === b.displayName &&
    a.kitchenName === b.kitchenName &&
    a.kitchenId === b.kitchenId &&
    a.kitchenRevision === b.kitchenRevision
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => tryReadSupabaseConfig(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingDraft | null>(null);
  const [booting, setBooting] = useState(config.ok);

  const refreshOnboarding = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setOnboarding(null);
      return;
    }
    const next = await resolveOnboarding(uid);
    setOnboarding((prev) => (onboardingEqual(prev, next) ? prev : next));
  }, [session?.user?.id]);

  const setOnboardingDraft = useCallback(
    async (draft: OnboardingDraft) => {
      const uid = session?.user?.id;
      if (!uid) return;
      await saveOnboardingState(uid, draft);
      setOnboarding((prev) => (onboardingEqual(prev, draft) ? prev : draft));
    },
    [session?.user?.id],
  );

  useEffect(() => {
    if (!config.ok) return;

    const supabase = getSupabase();
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, next) => {
        if (!active) return;

        setSession((prev) => {
          if (prev?.access_token === next?.access_token && prev?.user?.id === next?.user?.id) {
            return prev;
          }
          return next;
        });

        // Token refresh must not re-fetch profile/kitchen — that churned context
        // and made the whole app look like it was continuously re-rendering.
        if (event === 'TOKEN_REFRESHED') {
          setBooting(false);
          return;
        }

        if (next?.user) {
          const draft = await resolveOnboarding(next.user.id);
          if (!active) return;
          setOnboarding((prev) => (onboardingEqual(prev, draft) ? prev : draft));
        } else {
          setOnboarding(null);
        }
        setBooting(false);
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [config.ok]);

  const status: AuthStatus = !config.ok
    ? 'misconfigured'
    : booting
      ? 'loading'
      : !session
        ? 'unauthenticated'
        : onboarding?.completed
          ? 'authenticated'
          : 'needs_onboarding';

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: AUTH_CALLBACK_URL },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(
    async (opts?: { discardPending?: boolean }) => {
      const uid = session?.user?.id;
      if (uid) {
        const pending = await countPendingOutbox(uid);
        if (pending > 0 && !opts?.discardPending) {
          return { error: null, pendingCount: pending };
        }
        if (opts?.discardPending) {
          const { discardPendingMutations } = await import(
            '@/features/settings/api'
          );
          await discardPendingMutations(uid);
        }
        await cancelAllMappedReminders(uid);
        await clearAccountLocalData(uid);
      }
      await getSupabase().auth.signOut();
      setOnboarding(null);
      return { error: null };
    },
    [session?.user?.id],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: AUTH_CALLBACK_URL },
    );
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    return { error: error?.message ?? null };
  }, []);

  const finishOnboarding = useCallback(
    async (input: {
      mode: KitchenMode;
      displayName: string;
      kitchenName: string;
    }) => {
      const uid = session?.user?.id;
      if (!uid) return { error: 'Not signed in.' };
      try {
        const draft = await completeOnboarding({ userId: uid, ...input });
        // Prefer server kitchen if complete_onboarding was wired.
        const resolved = await resolveOnboarding(uid);
        setOnboarding(resolved ?? draft);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Onboarding failed.' };
      }
    },
    [session?.user?.id],
  );

  const configError = config.ok ? null : config.error.message;

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      onboarding,
      configError,
      kitchenMode: onboarding?.mode ?? 'home',
      kitchenId: onboarding?.kitchenId ?? null,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      finishOnboarding,
      refreshOnboarding,
      setOnboardingDraft,
    }),
    [
      status,
      session,
      onboarding,
      configError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      finishOnboarding,
      refreshOnboarding,
      setOnboardingDraft,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
