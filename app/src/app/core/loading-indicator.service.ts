import { Injectable, signal } from '@angular/core';

// Minimum time the bar stays visible so fast requests still register.
const MIN_VISIBLE_MS = 250;

/** Aggregate in-flight-request counter driving the top progress line in `AppShell`. */
@Injectable({ providedIn: 'root' })
export class LoadingIndicatorService {
  private readonly count = signal(0);
  readonly visible = signal(false);

  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;

  start(): void {
    this.count.update((n) => n + 1);
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (!this.visible()) {
      this.shownAt = Date.now();
      this.visible.set(true);
    }
  }

  stop(): void {
    this.count.update((n) => Math.max(0, n - 1));
    if (this.count() > 0 || this.hideTimer) return;

    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - this.shownAt));
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.visible.set(false);
    }, remaining);
  }
}
