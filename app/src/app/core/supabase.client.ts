import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeEnv } from './config';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const env = getRuntimeEnv();
    client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
  return client;
}
