import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';

import type { KitchenMode } from '@/i18n';
import { t } from '@/i18n';
import { cancelAllMappedReminders } from '@/lib/notifications';
import {
  clearSyncedCache,
  countPendingOutbox,
  ensureDailyLocalBackup,
  reassignLocalOnlyKitchen,
} from '@/lib/storage';
import { tryReadSupabaseConfig } from '@/lib/supabase';
import { AUTH_CALLBACK_URL, getSupabase } from '@/lib/supabase/client';
import { completeOnboarding } from '@/features/onboarding/api';
import {
  fetchProfile,
  listOwnedKitchens,
} from '@/features/kitchens/api';
import { errorMessage } from '@/lib/errors';
import {
  loadOnboardingState,
  saveOnboardingState,
  type OnboardingDraft,
} from './onboardingStore';
import { applyAuthUrl, isAuthCallbackUrl } from './sessionFromUrl';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'needs_onboarding'
  | 'authenticated'
  | 'misconfigured'
  | 'offline_unknown';

type SignUpResult = {
  error: string | null;
  needsConfirmation?: boolean;
  alreadyRegistered?: boolean;
};

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  onboarding: OnboardingDraft | null;
  configError: string | null;
  kitchenMode: KitchenMode;
  kitchenId: string | null;
  recoveryPending: boolean;
  authLinkError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
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

type ResolveResult = { draft: OnboardingDraft | null; unknown: boolean };

async function resolveOnboarding(userId: string): Promise<ResolveResult> {
  let local: OnboardingDraft | null = null;
  try {
    local = await loadOnboardingState(userId);
  } catch {
    local = null;
  }

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
      return { draft, unknown: false };
    }
    if (profile && !kitchen) {
      return {
        draft: {
          completed: false,
          mode: local?.mode ?? 'home',
          displayName: profile.displayName,
          kitchenName: local?.kitchenName ?? '',
        },
        unknown: false,
      };
    }
  } catch {
    if (!local) return { draft: null, unknown: true };
  }

  return { draft: local, unknown: false };
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

async function hydrateLocalOnly(userId: string, kitchenId: string | undefined) {
  if (!kitchenId) return;
  try {
    await reassignLocalOnlyKitchen(userId, kitchenId);
    await ensureDailyLocalBackup(userId);
  } catch {
    /* local-only helpers must never block sign-in */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => tryReadSupabaseConfig(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingDraft | null>(null);
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const [booting, setBooting] = useState(config.ok);
  const [offlineUnknown, setOfflineUnknown] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const seq = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const lastAuthUrl = useRef<string | null>(null);

  const applyDraft = useCallback((uid: string, draft: OnboardingDraft | null) => {
    if (currentUserId.current !== uid) return;
    setOnboarding((prev) => (onboardingEqual(prev, draft) ? prev : draft));
    setResolvedFor(uid);
  }, []);

  const refreshOnboarding = useCallback(async () => {
    const uid = currentUserId.current ?? session?.user?.id;
    if (!uid) {
      setOnboarding(null);
      setOfflineUnknown(false);
      return;
    }
    const my = ++seq.current;
    const { draft, unknown } = await resolveOnboarding(uid);
    if (my !== seq.current || currentUserId.current !== uid) return;
    setOfflineUnknown(unknown);
    applyDraft(uid, draft);
    if (draft?.kitchenId) await hydrateLocalOnly(uid, draft.kitchenId);
  }, [session?.user?.id, applyDraft]);

  const setOnboardingDraft = useCallback(async (draft: OnboardingDraft) => {
    const uid = currentUserId.current;
    if (!uid) return;
    await saveOnboardingState(uid, draft);
    if (currentUserId.current !== uid) return;
    setOnboarding((prev) => (onboardingEqual(prev, draft) ? prev : draft));
  }, []);

  useEffect(() => {
    if (!config.ok) return;
    const supabase = getSupabase();
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (!active) return;
      const my = ++seq.current;
      const uid = next?.user?.id ?? null;
      currentUserId.current = uid;

      setSession((prev) => {
        if (
          prev?.access_token === next?.access_token &&
          prev?.user?.id === next?.user?.id &&
          prev?.user?.updated_at === next?.user?.updated_at
        ) {
          return prev;
        }
        return next;
      });

      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryPending(true);
      } else if (event === 'SIGNED_OUT') {
        setRecoveryPending(false);
      } else if (event === 'SIGNED_IN') {
        /* keep recoveryPending if this SIGNED_IN is the recovery session */
      }

      try {
        if (event === 'TOKEN_REFRESHED') return;
        if (event === 'USER_UPDATED' && resolvedFor === uid && uid) return;

        if (uid) {
          const { draft, unknown } = await resolveOnboarding(uid);
          if (!active || my !== seq.current) return;
          setOfflineUnknown(unknown);
          applyDraft(uid, draft);
          if (draft?.kitchenId) await hydrateLocalOnly(uid, draft.kitchenId);
        } else {
          if (!active || my !== seq.current) return;
          setOnboarding(null);
          setResolvedFor(null);
          setOfflineUnknown(false);
        }
      } catch {
        if (!active || my !== seq.current) return;
        if (!uid) {
          setOnboarding(null);
          setResolvedFor(null);
        }
        setOfflineUnknown(Boolean(uid) && !onboarding);
      } finally {
        if (active && my === seq.current) {
          if (event !== 'TOKEN_REFRESHED') {
            setResolvedFor((prev) => (uid ? prev ?? uid : null));
          }
          setBooting(false);
        }
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // resolvedFor / onboarding read only for USER_UPDATED skip; seq handles races.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.ok, applyDraft]);

  useEffect(() => {
    if (!config.ok) return;
    const supabase = getSupabase();
    const onChange = (state: string) => {
      if (state === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    };
    const sub = AppState.addEventListener('change', onChange);
    if (AppState.currentState === 'active') void supabase.auth.startAutoRefresh();
    return () => sub.remove();
  }, [config.ok]);

  useEffect(() => {
    if (!config.ok) return;
    let active = true;
    const consume = async (url: string) => {
      if (!active || !isAuthCallbackUrl(url) || lastAuthUrl.current === url) return;
      lastAuthUrl.current = url;
      const result = await applyAuthUrl(url);
      if (!active) return;
      if (result.error) setAuthLinkError(result.error);
      if (result.type === 'recovery') setRecoveryPending(true);
    };
    void Linking.getInitialURL().then((url) => {
      if (url) void consume(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      void consume(url);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [config.ok]);

  const status: AuthStatus = !config.ok
    ? 'misconfigured'
    : booting || (session && resolvedFor !== session.user.id)
      ? 'loading'
      : !session
        ? 'unauthenticated'
        : offlineUnknown
          ? 'offline_unknown'
          : onboarding?.completed
            ? 'authenticated'
            : 'needs_onboarding';

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    try {
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: AUTH_CALLBACK_URL },
      });
      if (error) return { error: error.message };
      const alreadyRegistered = (data.user?.identities?.length ?? 0) === 0;
      return {
        error: alreadyRegistered ? t().auth.alreadyRegistered : null,
        needsConfirmation: !data.session && !alreadyRegistered,
        alreadyRegistered,
      };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const signOut = useCallback(
    async (opts?: { discardPending?: boolean }) => {
      const uid = currentUserId.current ?? session?.user?.id;
      try {
        if (uid) {
          const pending = await countPendingOutbox(uid);
          if (pending > 0 && !opts?.discardPending) {
            return { error: null, pendingCount: pending };
          }
          if (opts?.discardPending) {
            const { discardPendingMutations } = await import('@/features/settings/api');
            await discardPendingMutations(uid);
          }
        }
      } catch (e) {
        return { error: errorMessage(e) };
      }

      try {
        await getSupabase().auth.signOut();
      } catch (e) {
        return { error: errorMessage(e) };
      } finally {
        setOnboarding(null);
        setResolvedFor(null);
        setRecoveryPending(false);
        currentUserId.current = null;
        if (uid) {
          try {
            await cancelAllMappedReminders(uid);
          } catch {
            /* best-effort */
          }
          try {
            await clearSyncedCache(uid);
          } catch {
            /* best-effort */
          }
        }
      }
      return { error: null };
    },
    [session?.user?.id],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: AUTH_CALLBACK_URL,
      });
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (!error) setRecoveryPending(false);
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const finishOnboarding = useCallback(
    async (input: {
      mode: KitchenMode;
      displayName: string;
      kitchenName: string;
    }) => {
      const uid = currentUserId.current ?? session?.user?.id;
      if (!uid) return { error: t().auth.notSignedIn };
      try {
        const draft = await completeOnboarding({ userId: uid, ...input });
        const { draft: resolved } = await resolveOnboarding(uid);
        if (currentUserId.current !== uid) return { error: null };
        const next = resolved?.completed ? resolved : draft;
        await saveOnboardingState(uid, next);
        applyDraft(uid, next);
        setOfflineUnknown(false);
        if (next.kitchenId) await hydrateLocalOnly(uid, next.kitchenId);
        return { error: null };
      } catch (e) {
        return { error: errorMessage(e) || t().auth.onboardingFailed };
      }
    },
    [session?.user?.id, applyDraft],
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
      recoveryPending,
      authLinkError,
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
      recoveryPending,
      authLinkError,
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
