export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

export function readSupabaseConfig(): SupabasePublicConfig {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new SupabaseConfigError(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and restart Expo.',
    );
  }

  if (!/^https:\/\//.test(url)) {
    throw new SupabaseConfigError(
      'EXPO_PUBLIC_SUPABASE_URL must be an https URL.',
    );
  }

  // Never read SUPABASE_SERVICE_ROLE_KEY in client code.
  return { url, publishableKey };
}

export function tryReadSupabaseConfig():
  | { ok: true; config: SupabasePublicConfig }
  | { ok: false; error: SupabaseConfigError } {
  try {
    return { ok: true, config: readSupabaseConfig() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof SupabaseConfigError
          ? error
          : new SupabaseConfigError(String(error)),
    };
  }
}
