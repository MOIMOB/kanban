import { inject, Injectable, signal } from '@angular/core';
import { getSupabase } from '../../core/supabase.client';
import { AuthService } from '../../core/auth.service';
import { LoadingIndicatorService } from '../../core/loading-indicator.service';
import type { Board, BoardRole, BoardWithRole, Column } from '../../core/models';

export const DEFAULT_COLUMNS = ['To Do', 'Doing', 'Done'];

@Injectable({ providedIn: 'root' })
export class BoardsService {
  private readonly supabase = getSupabase();
  private readonly auth = inject(AuthService);
  private readonly loadingIndicator = inject(LoadingIndicatorService);

  readonly boards = signal<BoardWithRole[]>([]);
  // False until the first load settles.
  readonly loaded = signal(false);

  async loadBoards(): Promise<void> {
    const userId = await this.auth.currentUserId();
    if (!userId) return;
    this.loadingIndicator.start();
    try {
      const [ownedRes, sharedRes] = await Promise.all([
        this.supabase.from('kanban_boards').select('*').eq('owner_id', userId),
        this.supabase
          .from('kanban_board_members')
          .select('role, kanban_boards(*)')
          .eq('user_id', userId),
      ]);
      if (ownedRes.error) throw ownedRes.error;
      if (sharedRes.error) throw sharedRes.error;

      const owned: BoardWithRole[] = (ownedRes.data as Board[]).map((b) => ({
        ...b,
        role: 'owner' as BoardRole,
      }));
      const shared: BoardWithRole[] = (sharedRes.data as any[])
        .filter((row) => row.kanban_boards)
        .map((row) => ({ ...(row.kanban_boards as Board), role: row.role as BoardRole }));

      this.boards.set([...owned, ...shared].sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      this.loadingIndicator.stop();
      this.loaded.set(true);
    }
  }

  async createBoard(name: string, columnNames: string[] = DEFAULT_COLUMNS): Promise<Board> {
    const userId = await this.auth.currentUserId();
    if (!userId) throw new Error('Not signed in');

    // Client-generated id, no `.select()`: RETURNING would fail the RLS SELECT check.
    const id = crypto.randomUUID();
    const { error } = await this.supabase
      .from('kanban_boards')
      .insert({ id, name, owner_id: userId, user_id: userId });
    if (error) throw error;

    const columns = columnNames.map((colName, i) => ({
      board_id: id,
      name: colName,
      position: i,
      user_id: userId,
    }));
    const { error: colError } = await this.supabase.from('kanban_columns').insert(columns);
    if (colError) throw colError;

    const board: BoardWithRole = { id, name, owner_id: userId, created_at: new Date().toISOString(), role: 'owner' };
    this.boards.update((list) => [...list, board].sort((a, b) => a.name.localeCompare(b.name)));
    return board;
  }

  async deleteBoard(boardId: string): Promise<void> {
    const previous = this.boards();
    this.boards.update((list) => list.filter((b) => b.id !== boardId));
    const { error } = await this.supabase.from('kanban_boards').delete().eq('id', boardId);
    if (error) {
      this.boards.set(previous);
      throw error;
    }
  }

  async renameBoard(boardId: string, name: string): Promise<void> {
    const previous = this.boards().find((b) => b.id === boardId)?.name;
    this.boards.update((list) => list.map((b) => (b.id === boardId ? { ...b, name } : b)));
    const { error } = await this.supabase.from('kanban_boards').update({ name }).eq('id', boardId);
    if (error) {
      if (previous !== undefined) {
        this.boards.update((list) => list.map((b) => (b.id === boardId ? { ...b, name: previous } : b)));
      }
      throw error;
    }
  }

  async loadColumns(boardId: string): Promise<Column[]> {
    const { data, error } = await this.supabase
      .from('kanban_columns')
      .select('*')
      .eq('board_id', boardId)
      .order('position');
    if (error) throw error;
    return data as Column[];
  }

  /** Replaces a board's columns with `columns`, in order. Entries with `id: null` are new. */
  async saveColumns(boardId: string, columns: { id: string | null; name: string }[]): Promise<void> {
    const userId = await this.auth.currentUserId();
    const existing = await this.loadColumns(boardId);
    const keepIds = new Set(columns.map((c) => c.id).filter((id): id is string => id !== null));
    const toDelete = existing.filter((c) => !keepIds.has(c.id));
    const ordered = columns.map((c, position) => ({ ...c, position }));
    const toUpdate = ordered.filter((c): c is typeof c & { id: string } => c.id !== null);
    const toInsert = ordered.filter((c) => c.id === null);

    if (toDelete.length) {
      const { error } = await this.supabase
        .from('kanban_columns')
        .delete()
        .in('id', toDelete.map((c) => c.id));
      if (error) throw error;
    }
    await Promise.all(
      toUpdate.map((c) =>
        this.supabase.from('kanban_columns').update({ name: c.name, position: c.position }).eq('id', c.id),
      ),
    );
    if (toInsert.length) {
      const { error } = await this.supabase.from('kanban_columns').insert(
        toInsert.map((c) => ({ board_id: boardId, name: c.name, position: c.position, user_id: userId })),
      );
      if (error) throw error;
    }
  }
}
