import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeEnv, isDemoMode } from './config';
import { createDemoClient } from './demo-client';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    if (isDemoMode()) {
      client = createDemoClient() as unknown as SupabaseClient<Database>;
    } else {
      const env = getRuntimeEnv();
      client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    }
  }
  return client;
}
