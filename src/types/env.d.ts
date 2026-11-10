declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    /** Server/agent only — never import in client modules. */
    SUPABASE_SERVICE_ROLE_KEY?: string;
    EXPO_PUBLIC_SANITY_PROJECT_ID?: string;
    EXPO_PUBLIC_SANITY_DATASET?: string;
    EXPO_PUBLIC_SANITY_API_VERSION?: string;
    /** CLI/import only — never import in client modules. */
    SANITY_API_WRITE_TOKEN?: string;
  }
}
