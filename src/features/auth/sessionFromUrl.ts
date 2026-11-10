import * as Linking from 'expo-linking';

import { getSupabase } from '@/lib/supabase/client';
import { t } from '@/i18n';

export type AuthLinkResult = {
  error: string | null;
  type: string | null;
};

function paramsFromUrl(url: string): Record<string, string | undefined> {
  const parsed = Linking.parse(url);
  const params = { ...(parsed.queryParams ?? {}) } as Record<string, string | undefined>;
  const hash = url.split('#')[1];
  if (hash) {
    for (const part of hash.split('&')) {
      const [k, v] = part.split('=');
      if (k && v) params[k] = decodeURIComponent(v);
    }
  }
  return params;
}

/** Exchange a deep-link URL (implicit tokens or PKCE code) for a session. */
export async function applyAuthUrl(url: string): Promise<AuthLinkResult> {
  const params = paramsFromUrl(url);
  const type = params.type ?? null;

  if (params.error_description || params.error) {
    return {
      error: params.error_description ?? params.error ?? t().auth.callbackFailed,
      type,
    };
  }

  try {
    if (params.access_token && params.refresh_token) {
      const { error } = await getSupabase().auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      return { error: error?.message ?? null, type };
    }
    if (params.code) {
      const { error } = await getSupabase().auth.exchangeCodeForSession(params.code);
      return { error: error?.message ?? null, type };
    }
  } catch (e) {
    return {
      error: e instanceof Error && e.message ? e.message : t().auth.callbackFailed,
      type,
    };
  }

  return { error: null, type };
}

export function isAuthCallbackUrl(url: string): boolean {
  return url.includes('auth/callback') || url.includes('reset-callback');
}
