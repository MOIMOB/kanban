import { Component, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { BoardDetailService } from '../board-detail.service';
import { CardTile } from '../card-tile/card-tile';
import type { Card, Column } from '../../../core/models';

/**
 * One column: header, card drop list and the add-card input. Used by both the
 * mobile single-column view and the desktop board. `dragHandle` makes the
 * header the handle for the parent column `cdkDrag`.
 */
@Component({
  selector: 'app-board-column',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, CdkDropList, CdkDrag, CdkDragHandle, CardTile],
  templateUrl: './board-column.html',
  host: { class: 'block bg-paper-2/70 rounded-xl p-3' },
})
export class BoardColumn {
  protected readonly detail = inject(BoardDetailService);

  readonly column = input.required<Column>();
  readonly canEdit = input(false);
  readonly dragHandle = input(false);
  readonly openCard = output<Card>();
  readonly deleteColumn = output<Column>();

  readonly newCardTitle = signal('');

  async addCard(): Promise<void> {
    const title = this.newCardTitle().trim();
    if (!title) return;
    this.newCardTitle.set('');
    await this.detail.addCard(this.column().id, title);
  }

  dropCard(event: CdkDragDrop<Card[]>): void {
    if (!this.canEdit()) return;
    const card = event.item.data as Card;
    this.detail.moveCard(card.id, this.column().id, event.currentIndex);
  }
}
