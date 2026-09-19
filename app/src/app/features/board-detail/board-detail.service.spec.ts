import { TestBed } from '@angular/core/testing';
import { BoardDetailService } from './board-detail.service';
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
});
