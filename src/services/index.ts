import { createClient } from '@supabase/supabase-js';
import { env, isBackendConfigured } from '@/lib/env';
import type { KircheApi } from './api';
import { createDemoApi } from './demoApi';
import { createSupabaseApi } from './supabaseApi';

export const api: KircheApi = isBackendConfigured
  ? createSupabaseApi(createClient(env.supabaseUrl!, env.supabaseAnonKey!, { auth: { persistSession: true, autoRefreshToken: true } }))
  : createDemoApi();

export { ApiError } from './api';
export type { KircheApi } from './api';
