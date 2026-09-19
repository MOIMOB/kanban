import { inject, Injectable, signal } from '@angular/core';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabase } from '../../core/supabase.client';
import { AuthService } from '../../core/auth.service';
import { LoadingIndicatorService } from '../../core/loading-indicator.service';
import type { Card, Column } from '../../core/models';

@Injectable()
export class BoardDetailService {
  private readonly supabase = getSupabase();
  private readonly auth = inject(AuthService);
  private readonly loadingIndicator = inject(LoadingIndicatorService);
  private channel: RealtimeChannel | null = null;
  private boardId: string | null = null;

  readonly columns = signal<Column[]>([]);
  readonly cards = signal<Card[]>([]);

  cardsIn(columnId: string): Card[] {
    return this.cards()
      .filter((c) => c.column_id === columnId)
      .sort((a, b) => a.position - b.position);
  }

  async load(boardId: string): Promise<void> {
    this.boardId = boardId;
    this.loadingIndicator.start();
    try {
      const [colRes, cardRes] = await Promise.all([
        this.supabase.from('kanban_columns').select('*').eq('board_id', boardId).order('position'),
        this.supabase
          .from('kanban_cards')
          .select('*, kanban_columns!inner(board_id)')
          .eq('kanban_columns.board_id', boardId),
      ]);
      if (colRes.error) throw colRes.error;
      if (cardRes.error) throw cardRes.error;
      this.columns.set(colRes.data as Column[]);
      this.cards.set(cardRes.data as Card[]);
    } finally {
      this.loadingIndicator.stop();
    }
    this.subscribeRealtime(boardId);
  }

  /** Applies remote changes incrementally instead of re-fetching the whole board. */
  private subscribeRealtime(boardId: string): void {
    this.channel?.unsubscribe();
    this.channel = this.supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_columns', filter: `board_id=eq.${boardId}` },
        (payload: RealtimePostgresChangesPayload<Column>) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as Partial<Column>).id;
            if (id) this.columns.update((cols) => cols.filter((c) => c.id !== id));
            return;
          }
          const row = payload.new as Column;
          this.columns.update((cols) => {
            const next = cols.some((c) => c.id === row.id)
              ? cols.map((c) => (c.id === row.id ? row : c))
              : [...cols, row];
            return next.slice().sort((a, b) => a.position - b.position);
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_cards' },
        (payload: RealtimePostgresChangesPayload<Card>) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as Partial<Card>).id;
            if (id) this.cards.update((cards) => cards.filter((c) => c.id !== id));
            return;
          }
          const row = payload.new as Card;
          if (!this.columns().some((c) => c.id === row.column_id)) return; // not this board
          this.cards.update((cards) =>
            cards.some((c) => c.id === row.id)
              ? cards.map((c) => (c.id === row.id ? row : c))
              : [...cards, row],
          );
        },
      )
      .subscribe();
  }

  dispose(): void {
    this.channel?.unsubscribe();
    this.channel = null;
  }

  async addColumn(name: string): Promise<void> {
    if (!this.boardId) return;
    const boardId = this.boardId;
    const position = this.columns().length;
    const id = crypto.randomUUID();
    const column: Column = { id, board_id: boardId, name, position };

    // Optimistic update first, so the UI doesn't wait on the auth round trip.
    this.columns.update((cols) => [...cols, column]);
    const userId = await this.auth.currentUserId();
    const { error } = await this.supabase
      .from('kanban_columns')
      .insert({ id, board_id: boardId, name, position, user_id: userId });
    if (error) {
      this.columns.update((cols) => cols.filter((c) => c.id !== id));
      throw error;
    }
  }

  async renameColumn(columnId: string, name: string): Promise<void> {
    const previous = this.columns().find((c) => c.id === columnId)?.name;
    this.columns.update((cols) => cols.map((c) => (c.id === columnId ? { ...c, name } : c)));
    const { error } = await this.supabase.from('kanban_columns').update({ name }).eq('id', columnId);
    if (error) {
      if (previous !== undefined) {
        this.columns.update((cols) => cols.map((c) => (c.id === columnId ? { ...c, name: previous } : c)));
      }
      throw error;
    }
  }

  async reorderColumns(orderedColumnIds: string[]): Promise<void> {
    const updates = orderedColumnIds.map((id, position) => ({ id, position }));
    const previous = this.columns();

    this.columns.update((cols) =>
      cols
        .map((c) => {
          const u = updates.find((x) => x.id === c.id);
          return u ? { ...c, position: u.position } : c;
        })
        .sort((a, b) => a.position - b.position),
    );

    try {
      await Promise.all(
        updates.map(async (u) => {
          const { error } = await this.supabase.from('kanban_columns').update({ position: u.position }).eq('id', u.id);
          if (error) throw error;
        }),
      );
    } catch (e) {
      this.columns.set(previous);
      throw e;
    }
  }

  async deleteColumn(columnId: string): Promise<void> {
    const previous = this.columns();
    this.columns.update((cols) => cols.filter((c) => c.id !== columnId));
    const { error } = await this.supabase.from('kanban_columns').delete().eq('id', columnId);
    if (error) {
      this.columns.set(previous);
      throw error;
    }
  }

  async addCard(columnId: string, title: string): Promise<void> {
    const position = this.cardsIn(columnId).length;
    // Client-generated id, no `.select()`: RETURNING would fail the RLS SELECT check.
    const id = crypto.randomUUID();
    const card: Card = {
      id,
      column_id: columnId,
      title,
      description: null,
      due_date: null,
      position,
      created_at: new Date().toISOString(),
      category_id: null,
    };

    // Optimistic update first, as in addColumn().
    this.cards.update((cards) => [...cards, card]);
    const userId = await this.auth.currentUserId();
    const { error } = await this.supabase
      .from('kanban_cards')
      .insert({ id, column_id: columnId, title, position, user_id: userId });
    if (error) {
      this.cards.update((cards) => cards.filter((c) => c.id !== id));
      throw error;
    }
  }

  async updateCard(
    cardId: string,
    changes: Partial<Pick<Card, 'title' | 'description' | 'due_date' | 'category_id'>>,
  ): Promise<void> {
    const previous = this.cards().find((c) => c.id === cardId);
    this.cards.update((cards) => cards.map((c) => (c.id === cardId ? { ...c, ...changes } : c)));
    const { error } = await this.supabase.from('kanban_cards').update(changes).eq('id', cardId);
    if (error) {
      if (previous) this.cards.update((cards) => cards.map((c) => (c.id === cardId ? previous : c)));
      throw error;
    }
  }

  async deleteCard(cardId: string): Promise<void> {
    const previous = this.cards();
    this.cards.update((cards) => cards.filter((c) => c.id !== cardId));
    const { error } = await this.supabase.from('kanban_cards').delete().eq('id', cardId);
    if (error) {
      this.cards.set(previous);
      throw error;
    }
  }

  /** Moves a card to a column at a given position, and re-numbers siblings. */
  async moveCard(cardId: string, toColumnId: string, toPosition: number): Promise<void> {
    const card = this.cards().find((c) => c.id === cardId);
    if (!card) return;

    const previous = this.cards();
    const fromColumnId = card.column_id;
    const destCards = this.cardsIn(toColumnId).filter((c) => c.id !== cardId);
    destCards.splice(toPosition, 0, { ...card, column_id: toColumnId });

    const updates = destCards.map((c, i) => ({ id: c.id, position: i }));

    this.cards.update((cards) =>
      cards.map((c) => {
        const update = updates.find((u) => u.id === c.id);
        if (!update) return c;
        return { ...c, column_id: toColumnId, position: update.position };
      }),
    );

    try {
      await Promise.all(
        updates.map(async (u) => {
          const { error } = await this.supabase
            .from('kanban_cards')
            .update({ column_id: toColumnId, position: u.position })
            .eq('id', u.id);
          if (error) throw error;
        }),
      );

      if (fromColumnId !== toColumnId) {
        const remaining = this.cardsIn(fromColumnId).map((c, i) => ({ id: c.id, position: i }));
        this.cards.update((cards) =>
          cards.map((c) => {
            const r = remaining.find((u) => u.id === c.id);
            return r ? { ...c, position: r.position } : c;
          }),
        );
        await Promise.all(
          remaining.map(async (u) => {
            const { error } = await this.supabase.from('kanban_cards').update({ position: u.position }).eq('id', u.id);
            if (error) throw error;
          }),
        );
      }
    } catch (e) {
      this.cards.set(previous);
      throw e;
    }
  }
}
