import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = 'kanban:theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly stored = localStorage.getItem(STORAGE_KEY);
  readonly dark = signal(
    this.stored ? this.stored === 'dark' : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
  );

  /** False once `override` is used, so an embed's forced theme isn't saved. */
  private persist = true;

  constructor() {
    effect(() => {
      const isDark = this.dark();
      document.documentElement.classList.toggle('dark', isDark);
      if (this.persist) localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    });
  }

  /** Forces a theme for this page load without saving it. */
  override(dark: boolean): void {
    this.persist = false;
    this.dark.set(dark);
  }

  toggle(): void {
    this.dark.update((v) => !v);
  }
}
