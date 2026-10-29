declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    /** Server/agent only — never import in client modules. */
    SUPABASE_SERVICE_ROLE_KEY?: string;
  }
}
