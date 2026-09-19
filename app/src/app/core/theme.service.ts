import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = 'kanban:theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly stored = localStorage.getItem(STORAGE_KEY);
  readonly dark = signal(
    this.stored ? this.stored === 'dark' : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
  );

  constructor() {
    effect(() => {
      const isDark = this.dark();
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.dark.update((v) => !v);
  }
}
