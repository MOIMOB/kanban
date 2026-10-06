import { TestBed } from '@angular/core/testing';
import { BoardDetailService, UNDO_MS } from './board-detail.service';
import type { Card } from '../../core/models';

(window as any).__env = { SUPABASE_URL: 'http://localhost:54321', SUPABASE_ANON_KEY: 'anon' };

function card(id: string, column_id: string, position: number): Card {
  return {
    id,
    column_id,
    position,
    title: id,
    description: null,
    due_date: null,
    created_at: '',
    category_id: null,
  };
}

function createService(): BoardDetailService {
  TestBed.configureTestingModule({ providers: [BoardDetailService] });
  return TestBed.inject(BoardDetailService);
}

describe('BoardDetailService', () => {
  it('cardsIn returns cards for a column sorted by position', () => {
    const service = createService();
    service.cards.set([card('b', 'col-1', 1), card('a', 'col-1', 0), card('c', 'col-2', 0)]);

    const result = service.cardsIn('col-1').map((c) => c.id);
    expect(result).toEqual(['a', 'b']);
  });

  it('cardsIn returns an empty array for a column with no cards', () => {
    const service = createService();
    service.cards.set([card('a', 'col-1', 0)]);

    expect(service.cardsIn('col-2')).toEqual([]);
  });

  describe('delete with undo', () => {
    function withFakeDb(service: BoardDetailService) {
      const deletes: { table: string; id: string }[] = [];
      (service as any).supabase = {
        from: (table: string) => ({
          delete: () => ({
            eq: async (_: string, id: string) => {
              deletes.push({ table, id });
              return { error: null };
            },
          }),
        }),
      };
      return deletes;
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('removes the card at once but deletes the row only after the undo window', async () => {
      const service = createService();
      const deletes = withFakeDb(service);
      service.cards.set([card('a', 'col-1', 0), card('b', 'col-1', 1)]);

      service.deleteCard('a');
      expect(service.cardsIn('col-1').map((c) => c.id)).toEqual(['b']);
      expect(service.pendingDeleteLabel()).toBe('Card deleted');
      expect(deletes).toEqual([]);

      await vi.advanceTimersByTimeAsync(UNDO_MS);
      expect(deletes).toEqual([{ table: 'kanban_cards', id: 'a' }]);
      expect(service.pendingDeleteLabel()).toBeNull();
    });

    it('undo restores the card and never deletes it', async () => {
      const service = createService();
      const deletes = withFakeDb(service);
      service.cards.set([card('a', 'col-1', 0), card('b', 'col-1', 1)]);

      service.deleteCard('a');
      service.undoDelete();
      await vi.advanceTimersByTimeAsync(UNDO_MS);

      expect(service.cardsIn('col-1').map((c) => c.id)).toEqual(['a', 'b']);
      expect(deletes).toEqual([]);
    });

    it('undo restores a deleted column with its cards', () => {
      const service = createService();
      withFakeDb(service);
      service.columns.set([
        { id: 'col-1', board_id: 'b', name: 'To Do', position: 0 },
        { id: 'col-2', board_id: 'b', name: 'Done', position: 1 },
      ]);
      service.cards.set([card('a', 'col-1', 0), card('c', 'col-2', 0)]);

      service.deleteColumn('col-1');
      expect(service.columns().map((c) => c.id)).toEqual(['col-2']);
      expect(service.cardsIn('col-1')).toEqual([]);

      service.undoDelete();
      expect(service.columns().map((c) => c.id)).toEqual(['col-1', 'col-2']);
      expect(service.cardsIn('col-1').map((c) => c.id)).toEqual(['a']);
    });

    it('a second delete commits the first one immediately', async () => {
      const service = createService();
      const deletes = withFakeDb(service);
      service.cards.set([card('a', 'col-1', 0), card('b', 'col-1', 1)]);

      service.deleteCard('a');
      service.deleteCard('b');
      await Promise.resolve();
      expect(deletes).toEqual([{ table: 'kanban_cards', id: 'a' }]);

      service.undoDelete();
      expect(service.cardsIn('col-1').map((c) => c.id)).toEqual(['b']);
    });

    it('puts the card back when the delete fails', async () => {
      const service = createService();
      (service as any).supabase = {
        from: () => ({ delete: () => ({ eq: async () => ({ error: new Error('nope') }) }) }),
      };
      vi.spyOn(console, 'error').mockImplementation(() => {});
      service.cards.set([card('a', 'col-1', 0)]);

      service.deleteCard('a');
      await vi.advanceTimersByTimeAsync(UNDO_MS);
      expect(service.cardsIn('col-1').map((c) => c.id)).toEqual(['a']);
    });
  });
});
