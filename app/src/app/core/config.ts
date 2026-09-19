interface RuntimeEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

declare global {
  interface Window {
    __env?: RuntimeEnv;
  }
}

export function getRuntimeEnv(): RuntimeEnv {
  const env = window.__env;
  if (!env?.SUPABASE_URL || !env?.SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing runtime config. Copy public/env.example.js to public/env.js and fill in your Supabase project values.',
    );
  }
  return env;
}
