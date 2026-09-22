import { Component, computed, inject, OnDestroy, OnInit, signal, viewChild, ElementRef } from '@angular/core';
import type { injectSnapshotCapture } from '@anton-gustafsson/snapshot-angular';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { BoardDetailService } from '../board-detail.service';
import { BoardsService } from '../../boards/boards.service';
import { CategoriesService } from '../../categories/categories.service';
import { AuthService } from '../../../core/auth.service';
import { ThemeService } from '../../../core/theme.service';
import { ShareDialog } from '../share-dialog/share-dialog';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import type { Card, Column } from '../../../core/models';

@Component({
  selector: 'app-board-detail-page',
  standalone: true,
  imports: [FormsModule, RouterLink, CdkDropList, CdkDropListGroup, CdkDrag, CdkDragHandle, ShareDialog, ConfirmDialog],
  providers: [BoardDetailService],
  templateUrl: './board-detail-page.html',
})
export class BoardDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  protected readonly boardsService = inject(BoardsService);
  protected readonly detail = inject(BoardDetailService);
  protected readonly categoriesService = inject(CategoriesService);
  protected readonly theme = inject(ThemeService);

  boardId = '';
  newColumnName = '';
  newCardTitle = signal<Record<string, string>>({});
  editingCard = signal<Card | null>(null);
  sharingOpen = signal(false);
  deletingColumn = signal<Column | null>(null);
  deletingColumnBusy = signal(false);
  singleColumnMode = signal(localStorage.getItem('kanban:singleColumnMode') === 'true');
  activeColumnIndex = signal(0);
  private touchStartX = 0;
  private readonly captureContent = viewChild<ElementRef<HTMLElement>>('captureContent');

  readonly board = computed(() =>
    this.boardsService.boards().find((b) => b.id === this.boardId),
  );
  readonly canEdit = computed(() => {
    const role = this.board()?.role;
    return role === 'owner' || role === 'editor';
  });
  readonly isOwner = computed(() => this.board()?.role === 'owner');
  readonly clampedColumnIndex = computed(() =>
    Math.min(this.activeColumnIndex(), Math.max(0, this.detail.columns().length - 1)),
  );
  readonly activeColumn = computed(() => this.detail.columns()[this.clampedColumnIndex()]);

  async ngOnInit(): Promise<void> {
    this.boardId = this.route.snapshot.paramMap.get('id')!;
    if (this.boardsService.boards().length === 0) {
      await this.boardsService.loadBoards();
    }
    this.categoriesService.loadCategories();
    await this.detail.load(this.boardId);
  }

  categoryFor(categoryId: string | null): { name: string; color: string } | null {
    if (!categoryId) return null;
    return this.categoriesService.categories().find((c) => c.id === categoryId) ?? null;
  }

  ngOnDestroy(): void {
    this.detail.dispose();
  }

  /**
   * Called from `boardSnapshotGuard` on the way out. Clones the columns
   * synchronously into an off-screen node before any `await`, since the view
   * is destroyed right after. Scaled to cover the 2:1 preview frame.
   */
  async captureSnapshot(capture: ReturnType<typeof injectSnapshotCapture>): Promise<void> {
    const content = this.captureContent()?.nativeElement;
    if (!content || !this.boardId) return;

    const clone = content.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.top = '-10000px';
    clone.style.left = '-10000px';
    clone.style.pointerEvents = 'none';
    clone.style.width = `${content.scrollWidth}px`;
    clone.style.padding = '16px';
    clone.style.boxSizing = 'content-box';
    clone.style.background = 'var(--color-paper)';
    document.body.append(clone);
    try {
      // No `fit`: the package's fit frame sits at left:-99999px, which html2canvas
      // then crops from the wrong origin. Capture the clone directly instead.
      await capture(clone, this.boardId, {
        variant: this.theme.dark() ? 'dark' : 'light',
        contentCrop: false,
        neutralizeColors: true,
      });
    } finally {
      clone.remove();
    }
  }

  toggleSingleColumnMode(): void {
    const next = !this.singleColumnMode();
    this.singleColumnMode.set(next);
    localStorage.setItem('kanban:singleColumnMode', String(next));
    this.activeColumnIndex.set(0);
  }

  prevColumn(): void {
    this.activeColumnIndex.update(() => Math.max(0, this.clampedColumnIndex() - 1));
  }

  nextColumn(): void {
    const max = Math.max(0, this.detail.columns().length - 1);
    this.activeColumnIndex.update(() => Math.min(max, this.clampedColumnIndex() + 1));
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent): void {
    const dx = event.changedTouches[0].clientX - this.touchStartX;
    const threshold = 50;
    if (dx > threshold) this.prevColumn();
    else if (dx < -threshold) this.nextColumn();
  }

  async addColumn(): Promise<void> {
    const name = this.newColumnName.trim();
    if (!name) return;
    this.newColumnName = '';
    await this.detail.addColumn(name);
  }

  async addCard(columnId: string): Promise<void> {
    const title = (this.newCardTitle()[columnId] ?? '').trim();
    if (!title) return;
    this.newCardTitle.update((m) => ({ ...m, [columnId]: '' }));
    await this.detail.addCard(columnId, title);
  }

  setNewCardTitle(columnId: string, value: string): void {
    this.newCardTitle.update((m) => ({ ...m, [columnId]: value }));
  }

  openCard(card: Card): void {
    if (!this.canEdit()) return;
    this.editingCard.set(card);
  }

  async copyCard(card: Card, event: Event): Promise<void> {
    event.stopPropagation();
    const text = card.description ? `${card.title}\n\n${card.description}` : card.title;
    await navigator.clipboard.writeText(text);
  }

  async saveCard(): Promise<void> {
    const card = this.editingCard();
    if (!card) return;
    await this.detail.updateCard(card.id, {
      title: card.title,
      description: card.description,
      due_date: card.due_date,
      category_id: card.category_id,
    });
    this.editingCard.set(null);
  }

  async deleteEditingCard(): Promise<void> {
    const card = this.editingCard();
    if (!card) return;
    await this.detail.deleteCard(card.id);
    this.editingCard.set(null);
  }

  requestDeleteColumn(column: Column): void {
    if (this.detail.cardsIn(column.id).length > 1) {
      this.deletingColumn.set(column);
      return;
    }
    this.detail.deleteColumn(column.id);
  }

  async confirmDeleteColumn(): Promise<void> {
    const column = this.deletingColumn();
    if (!column) return;
    this.deletingColumnBusy.set(true);
    try {
      await this.detail.deleteColumn(column.id);
      this.deletingColumn.set(null);
    } finally {
      this.deletingColumnBusy.set(false);
    }
  }

  dropColumn(event: CdkDragDrop<Column[]>): void {
    if (!this.canEdit()) return;
    const columns = [...this.detail.columns()];
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    this.detail.reorderColumns(columns.map((c) => c.id));
  }

  dropCard(event: CdkDragDrop<Card[]>, columnId: string): void {
    if (!this.canEdit()) return;
    const card = event.item.data as Card;
    this.detail.moveCard(card.id, columnId, event.currentIndex);
  }
}
