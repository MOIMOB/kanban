import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriesService, DEFAULT_CATEGORY_COLOR } from '../categories.service';
import type { Category } from '../../../core/models';

@Component({
  selector: 'app-category-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './category-dialog.html',
})
export class CategoryDialog implements OnInit {
  @Input() category: Category | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Category>();
  @Output() deleteRequested = new EventEmitter<Category>();

  private readonly categoriesService = inject(CategoriesService);

  name = '';
  color = DEFAULT_CATEGORY_COLOR;
  saving = signal(false);
  error = signal<string | null>(null);

  get isEdit(): boolean {
    return this.category !== null;
  }

  ngOnInit(): void {
    this.name = this.category?.name ?? '';
    this.color = this.category?.color ?? DEFAULT_CATEGORY_COLOR;
  }

  requestDelete(): void {
    if (this.category) this.deleteRequested.emit(this.category);
  }

  async save(): Promise<void> {
    const name = this.name.trim();
    if (!name) {
      this.error.set('Category name is required');
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    try {
      if (this.category) {
        await this.categoriesService.updateCategory(this.category.id, { name, color: this.color });
        this.saved.emit({ ...this.category, name, color: this.color });
      } else {
        const category = await this.categoriesService.createCategory(name, this.color);
        this.saved.emit(category);
      }
    } catch (e) {
      const message = (e as { message?: string })?.message;
      this.error.set(message ?? 'Could not save category');
    } finally {
      this.saving.set(false);
    }
  }
}
