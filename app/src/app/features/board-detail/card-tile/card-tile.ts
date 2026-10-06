import { Component, computed, inject, input } from '@angular/core';
import { CategoriesService } from '../../categories/categories.service';
import type { Card } from '../../../core/models';
import { BoardDetailService } from '../board-detail.service';
import { cardMatches, isFilterActive } from '../card-filter';

/** A card on the board. Drag/click behaviour is attached by the parent column. */
@Component({
  selector: 'app-card-tile',
  standalone: true,
  templateUrl: './card-tile.html',
  host: {
    class:
      'group relative block bg-surface rounded-lg p-3 shadow-sm border border-transparent cursor-pointer hover:border-accent hover:shadow-md transition-all',
    '[class.opacity-30]': 'dimmed()',
    '[attr.data-filtered-out]': 'dimmed() || null',
  },
})
export class CardTile {
  private readonly categoriesService = inject(CategoriesService);
  private readonly detail = inject(BoardDetailService);

  readonly card = input.required<Card>();
  readonly category = computed(() => {
    const id = this.card().category_id;
    return id ? (this.categoriesService.categories().find((c) => c.id === id) ?? null) : null;
  });

  readonly dimmed = computed(() => {
    const filter = this.detail.filter();
    return isFilterActive(filter) && !cardMatches(this.card(), filter, this.category()?.name);
  });

  async copy(event: Event): Promise<void> {
    event.stopPropagation();
    const card = this.card();
    const text = card.description ? `${card.title}\n\n${card.description}` : card.title;
    await navigator.clipboard.writeText(text);
  }
}
