import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.ready()) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (auth.ready()) resolve();
        else setTimeout(check, 20);
      };
      check();
    });
  }

  if (auth.user()) return true;
  return router.parseUrl('/login');
};
