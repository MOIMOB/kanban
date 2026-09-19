import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  function setup(user: unknown) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { ready: signal(true), user: signal(user) },
        },
      ],
    });
  }

  it('redirects to /login when signed out', async () => {
    setup(null);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.parseUrl('/login'));
  });

  it('allows access when signed in', async () => {
    setup({ id: 'user-1' });
    const result = await TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).toBe(true);
  });
});
