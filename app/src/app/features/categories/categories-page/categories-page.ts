import { Component, inject, OnInit, signal } from '@angular/core';
import { CategoriesService } from '../categories.service';
import { CategoryDialog } from '../category-dialog/category-dialog';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import type { Category } from '../../../core/models';

type DialogMode = { mode: 'create' } | { mode: 'edit'; category: Category };

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [CategoryDialog, ConfirmDialog],
  templateUrl: './categories-page.html',
})
export class CategoriesPage implements OnInit {
  protected readonly categoriesService = inject(CategoriesService);

  dialogMode = signal<DialogMode | null>(null);
  deletingCategory = signal<Category | null>(null);
  deleting = signal(false);

  ngOnInit(): void {
    this.categoriesService.loadCategories();
  }

  openCreateDialog(): void {
    this.dialogMode.set({ mode: 'create' });
  }

  openEditDialog(category: Category): void {
    this.dialogMode.set({ mode: 'edit', category });
  }

  onCategorySaved(): void {
    this.dialogMode.set(null);
  }

  onDeleteRequested(category: Category): void {
    this.dialogMode.set(null);
    this.deletingCategory.set(category);
  }

  async confirmDelete(): Promise<void> {
    const category = this.deletingCategory();
    if (!category) return;
    this.deleting.set(true);
    try {
      await this.categoriesService.deleteCategory(category.id);
      this.deletingCategory.set(null);
    } finally {
      this.deleting.set(false);
    }
  }
}
