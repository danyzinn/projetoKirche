import { church } from '@/config/church';

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  defaultOrgSlug: church.slug,
};

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
