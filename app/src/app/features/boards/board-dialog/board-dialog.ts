import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { BoardsService, DEFAULT_COLUMNS } from '../boards.service';
import type { Board, BoardWithRole } from '../../../core/models';

interface DraftColumn {
  key: string;
  id: string | null;
  name: string;
}

@Component({
  selector: 'app-board-dialog',
  standalone: true,
  imports: [FormsModule, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './board-dialog.html',
})
export class BoardDialog implements OnInit {
  @Input() board: BoardWithRole | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Board>();
  @Output() deleteRequested = new EventEmitter<BoardWithRole>();

  private readonly boardsService = inject(BoardsService);

  name = '';
  columns = signal<DraftColumn[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  get isEdit(): boolean {
    return this.board !== null;
  }

  async ngOnInit(): Promise<void> {
    this.name = this.board?.name ?? '';
    if (this.board) {
      this.loading.set(true);
      try {
        const existing = await this.boardsService.loadColumns(this.board.id);
        this.columns.set(existing.map((c) => ({ key: crypto.randomUUID(), id: c.id, name: c.name })));
      } finally {
        this.loading.set(false);
      }
    } else {
      this.columns.set(DEFAULT_COLUMNS.map((name) => ({ key: crypto.randomUUID(), id: null, name })));
    }
  }

  requestDelete(): void {
    if (this.board) this.deleteRequested.emit(this.board);
  }

  addColumn(): void {
    this.columns.update((cols) => [...cols, { key: crypto.randomUUID(), id: null, name: '' }]);
  }

  removeColumn(key: string): void {
    if (this.columns().length <= 1) return;
    this.columns.update((cols) => cols.filter((c) => c.key !== key));
  }

  renameColumn(key: string, name: string): void {
    this.columns.update((cols) => cols.map((c) => (c.key === key ? { ...c, name } : c)));
  }

  dropColumn(event: CdkDragDrop<DraftColumn[]>): void {
    const cols = [...this.columns()];
    moveItemInArray(cols, event.previousIndex, event.currentIndex);
    this.columns.set(cols);
  }

  async save(): Promise<void> {
    const name = this.name.trim();
    if (!name) {
      this.error.set('Board name is required');
      return;
    }
    const columnNames = this.columns()
      .map((c) => c.name.trim())
      .filter((n) => n.length > 0);
    if (columnNames.length === 0) {
      this.error.set('At least one column is required');
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    try {
      if (this.board) {
        await this.boardsService.renameBoard(this.board.id, name);
        const columnPayload = this.columns()
          .filter((c) => c.name.trim().length > 0)
          .map((c) => ({ id: c.id, name: c.name.trim() }));
        await this.boardsService.saveColumns(this.board.id, columnPayload);
        this.saved.emit({ ...this.board, name });
      } else {
        const board = await this.boardsService.createBoard(name, columnNames);
        this.saved.emit(board);
      }
    } catch (e) {
      const message = (e as { message?: string })?.message;
      this.error.set(message ?? 'Could not save board');
    } finally {
      this.saving.set(false);
    }
  }
}
