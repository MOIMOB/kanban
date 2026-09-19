import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';
import { LoadingIndicatorService } from '../../core/loading-indicator.service';
import { isDemoMode } from '../../core/config';
import { resetDemoData } from '../../core/demo-client';

const STORAGE_KEY = 'kanban:sidebarCollapsed';
// Matches /boards/:id but not the /boards list itself.
const BOARD_DETAIL_RE = /^\/boards\/[^/]+/;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected readonly theme = inject(ThemeService);
  protected readonly loadingIndicator = inject(LoadingIndicatorService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly showMobileNav = computed(() => !BOARD_DETAIL_RE.test(this.url()));

  protected readonly demo = isDemoMode();

  collapsed = signal(localStorage.getItem(STORAGE_KEY) === 'true');

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/login');
  }

  resetDemo(): void {
    if (!confirm('Reset demo data to the starting state?')) return;
    resetDemoData();
    location.assign('/boards');
  }
}
