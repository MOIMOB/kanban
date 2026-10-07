import type { Params } from '@angular/router';

/**
 * Embed mode: `/embed/:boardId` renders a single board without the app shell,
 * for dashboards in iframes (Home Assistant, wall tablets, ...).
 *
 *   /embed/<boardId>?theme=dark&readonly=true&toolbar=false#email=...&password=...
 *
 * Credentials go in the URL fragment so they're never sent to the server
 * (no access logs, no Referer). They're stripped from the URL after sign-in.
 */
export interface EmbedConfig {
  /** Force a theme without persisting it; null = keep the stored/system theme. */
  theme: 'light' | 'dark' | null;
  /** Disable all editing, even if the signed-in user could edit. */
  readonly: boolean;
  /** Show the board title + search/category filter bar. */
  toolbar: boolean;
}

export interface EmbedCredentials {
  email: string;
  password: string;
}

const isTrue = (v: unknown) => v === 'true' || v === '1';
const isFalse = (v: unknown) => v === 'false' || v === '0';

export function parseEmbedConfig(query: Params): EmbedConfig {
  const theme = query['theme'];
  return {
    theme: theme === 'light' || theme === 'dark' ? theme : null,
    readonly: isTrue(query['readonly']),
    toolbar: !isFalse(query['toolbar']),
  };
}

export function parseEmbedCredentials(fragment: string | null | undefined): EmbedCredentials | null {
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const email = params.get('email');
  const password = params.get('password');
  return email && password ? { email, password } : null;
}
