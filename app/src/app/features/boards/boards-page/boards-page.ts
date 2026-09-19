import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BoardsService } from '../boards.service';
import { ThemeService } from '../../../core/theme.service';
import { BoardDialog } from '../board-dialog/board-dialog';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { SNAPSHOT_SERVICE, SnapshotNavListComponent, type NavItem } from '@anton-gustafsson/snapshot-angular';
import type { Board, BoardWithRole } from '../../../core/models';

type DialogMode = { mode: 'create' } | { mode: 'edit'; board: BoardWithRole };

@Component({
  selector: 'app-boards-page',
  standalone: true,
  imports: [BoardDialog, ConfirmDialog, SnapshotNavListComponent],
  templateUrl: './boards-page.html',
})
export class BoardsPage implements OnInit {
  protected readonly boardsService = inject(BoardsService);
  protected readonly theme = inject(ThemeService);
  private readonly snapshots = inject(SNAPSHOT_SERVICE);
  private readonly router = inject(Router);

  dialogMode = signal<DialogMode | null>(null);
  deletingBoard = signal<BoardWithRole | null>(null);
  deleting = signal(false);

  protected readonly navItems = computed<NavItem<BoardWithRole>[]>(() =>
    this.boardsService.boards().map((board) => ({
      id: board.id,
      label: board.name,
      description: board.role,
      data: board,
      editable: board.role === 'owner',
    })),
  );

  ngOnInit(): void {
    this.boardsService.loadBoards();
  }

  openCreateDialog(): void {
    this.dialogMode.set({ mode: 'create' });
  }

  onNavSelect(item: NavItem<BoardWithRole>): void {
    if (!item.data) return;
    this.router.navigate(['/boards', item.data.id]);
  }

  onNavEdit(item: NavItem<BoardWithRole>): void {
    if (!item.data) return;
    this.dialogMode.set({ mode: 'edit', board: item.data });
  }

  async onBoardSaved(board: Board): Promise<void> {
    const mode = this.dialogMode();
    this.dialogMode.set(null);
    if (mode?.mode === 'create') {
      await this.router.navigate(['/boards', board.id]);
    }
  }

  onDeleteRequested(board: BoardWithRole): void {
    this.dialogMode.set(null);
    this.deletingBoard.set(board);
  }

  async confirmDelete(): Promise<void> {
    const board = this.deletingBoard();
    if (!board) return;
    this.deleting.set(true);
    try {
      await this.boardsService.deleteBoard(board.id);
      await this.snapshots.remove(board.id);
      this.deletingBoard.set(null);
    } finally {
      this.deleting.set(false);
    }
  }
}
