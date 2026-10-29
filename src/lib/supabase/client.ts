import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { readSupabaseConfig } from './config';
import { authStorage } from './secureStore';

/** Password-reset / confirm deep link — must match Supabase Auth redirect allow-list. */
export const AUTH_CALLBACK_URL = 'kitchdo://auth/callback';

export type KdoClient = SupabaseClient<Database>;

let client: KdoClient | null = null;

export function getSupabase(): KdoClient {
  if (client) return client;

  const { url, publishableKey } = readSupabaseConfig();

  client = createClient<Database>(url, publishableKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}

export type { SupabaseClient };
