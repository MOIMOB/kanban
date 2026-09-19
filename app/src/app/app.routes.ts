import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { boardSnapshotGuard } from './features/board-detail/board-snapshot.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'boards' },
      {
        path: 'boards',
        loadComponent: () =>
          import('./features/boards/boards-page/boards-page').then((m) => m.BoardsPage),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories-page/categories-page').then((m) => m.CategoriesPage),
      },
      {
        path: 'boards/:id',
        canDeactivate: [boardSnapshotGuard],
        loadComponent: () =>
          import('./features/board-detail/board-detail-page/board-detail-page').then(
            (m) => m.BoardDetailPage,
          ),
      },
    ],
  },
];
