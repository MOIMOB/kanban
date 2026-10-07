import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { parseEmbedCredentials } from './embed';

/**
 * Signs in with `#email=...&password=...` from the URL fragment (if present),
 * then redirects to the same URL without it so credentials don't linger in
 * the address bar or history. Without credentials it behaves like authGuard.
 */
export const embedGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();

  const credentials = parseEmbedCredentials(route.fragment);
  if (credentials) {
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
    const signedInAs = auth.user()?.email?.toLowerCase();
    if (signedInAs !== credentials.email.toLowerCase()) {
      try {
        await auth.signIn(credentials.email, credentials.password);
      } catch {
        return router.parseUrl('/login');
      }
    }
    return router.createUrlTree(['/embed', route.paramMap.get('id')], { queryParams: route.queryParams });
  }

  if (auth.user()) return true;
  return router.parseUrl('/login');
};
