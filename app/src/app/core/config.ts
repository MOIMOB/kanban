interface RuntimeEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  /** 'true' = run fully in the browser (localStorage), no Supabase, no login. */
  DEMO_MODE?: string;
}

declare global {
  interface Window {
    __env?: RuntimeEnv;
  }
}

export function isDemoMode(): boolean {
  return window.__env?.DEMO_MODE === 'true';
}

export function getRuntimeEnv(): { SUPABASE_URL: string; SUPABASE_ANON_KEY: string } {
  const env = window.__env;
  if (!env?.SUPABASE_URL || !env?.SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing runtime config. Copy public/env.example.js to public/env.js and fill in your Supabase project values.',
    );
  }
  return { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY };
}
