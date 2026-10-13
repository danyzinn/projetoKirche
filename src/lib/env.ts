export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  defaultOrgSlug: import.meta.env.VITE_DEFAULT_ORG_SLUG as string | undefined,
};

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
