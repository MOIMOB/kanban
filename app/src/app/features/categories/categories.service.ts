import { uuid } from '../../core/uuid';
import { inject, Injectable, signal } from '@angular/core';
import { getSupabase } from '../../core/supabase.client';
import { AuthService } from '../../core/auth.service';
import { LoadingIndicatorService } from '../../core/loading-indicator.service';
import type { Category } from '../../core/models';

export const DEFAULT_CATEGORY_COLOR = '#6366f1';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly supabase = getSupabase();
  private readonly auth = inject(AuthService);
  private readonly loadingIndicator = inject(LoadingIndicatorService);

  readonly categories = signal<Category[]>([]);
  // False until the first load settles.
  readonly loaded = signal(false);

  async loadCategories(): Promise<void> {
    const userId = await this.auth.currentUserId();
    if (!userId) return;
    this.loadingIndicator.start();
    try {
      const { data, error } = await this.supabase
        .from('kanban_categories')
        .select('*')
        .eq('owner_id', userId)
        .order('name');
      if (error) throw error;
      this.categories.set(data as Category[]);
    } finally {
      this.loadingIndicator.stop();
      this.loaded.set(true);
    }
  }

  async createCategory(name: string, color: string = DEFAULT_CATEGORY_COLOR): Promise<Category> {
    const userId = await this.auth.currentUserId();
    if (!userId) throw new Error('Not signed in');
    const id = uuid();
    const category: Category = { id, name, color, owner_id: userId, created_at: new Date().toISOString() };

    this.categories.update((list) => [...list, category].sort((a, b) => a.name.localeCompare(b.name)));
    const { error } = await this.supabase
      .from('kanban_categories')
      .insert({ id, name, color, owner_id: userId, user_id: userId });
    if (error) {
      this.categories.update((list) => list.filter((c) => c.id !== id));
      throw error;
    }
    return category;
  }

  async updateCategory(id: string, changes: { name?: string; color?: string }): Promise<void> {
    const previous = this.categories().find((c) => c.id === id);
    this.categories.update((list) =>
      list.map((c) => (c.id === id ? { ...c, ...changes } : c)).sort((a, b) => a.name.localeCompare(b.name)),
    );
    const { error } = await this.supabase.from('kanban_categories').update(changes).eq('id', id);
    if (error) {
      if (previous) this.categories.update((list) => list.map((c) => (c.id === id ? previous : c)));
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    const previous = this.categories();
    this.categories.update((list) => list.filter((c) => c.id !== id));
    const { error } = await this.supabase.from('kanban_categories').delete().eq('id', id);
    if (error) {
      this.categories.set(previous);
      throw error;
    }
  }
}
