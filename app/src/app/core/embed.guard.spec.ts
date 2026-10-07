import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { embedGuard } from './embed.guard';
import { AuthService } from './auth.service';

describe('embedGuard', () => {
  function setup(user: { email: string } | null, signIn = vi.fn().mockResolvedValue(undefined)) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: signal(user), whenReady: async () => {}, signIn },
        },
      ],
    });
    return signIn;
  }

  function route(fragment: string | null) {
    return { fragment, paramMap: convertToParamMap({ id: 'b1' }), queryParams: { theme: 'dark' } } as any;
  }

  const run = (r: any) => TestBed.runInInjectionContext(() => embedGuard(r, {} as any));

  it('signs in from the fragment and redirects without it', async () => {
    const signIn = setup(null);
    const result = await run(route('email=wall@example.com&password=secret'));
    expect(signIn).toHaveBeenCalledWith('wall@example.com', 'secret');
    expect(TestBed.inject(Router).serializeUrl(result as any)).toBe('/embed/b1?theme=dark');
  });

  it('skips sign-in when already signed in as that user', async () => {
    const signIn = setup({ email: 'Wall@example.com' });
    await run(route('email=wall@example.com&password=secret'));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('sends to /login when sign-in fails', async () => {
    setup(null, vi.fn().mockRejectedValue(new Error('Invalid login credentials')));
    const result = await run(route('email=wall@example.com&password=wrong'));
    expect(result).toEqual(TestBed.inject(Router).parseUrl('/login'));
  });

  it('acts like authGuard without credentials', async () => {
    setup({ email: 'me@example.com' });
    expect(await run(route(null))).toBe(true);
  });
});
