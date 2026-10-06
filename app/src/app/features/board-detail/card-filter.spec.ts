import { cardMatches, EMPTY_FILTER, isFilterActive } from './card-filter';
import type { Card } from '../../core/models';

const card: Card = {
  id: 'a',
  column_id: 'col-1',
  position: 0,
  title: 'Fix login redirect',
  description: 'Users land on a blank page',
  due_date: null,
  created_at: '',
  category_id: 'cat-bug',
};

describe('cardMatches', () => {
  it('matches everything with an empty filter', () => {
    expect(cardMatches(card, EMPTY_FILTER)).toBe(true);
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
  });

  it('matches title, description and category name case-insensitively', () => {
    expect(cardMatches(card, { query: 'LOGIN', categoryId: null })).toBe(true);
    expect(cardMatches(card, { query: 'blank page', categoryId: null })).toBe(true);
    expect(cardMatches(card, { query: 'bug', categoryId: null }, 'Bug')).toBe(true);
    expect(cardMatches(card, { query: 'signup', categoryId: null }, 'Bug')).toBe(false);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(cardMatches(card, { query: '  login ', categoryId: null })).toBe(true);
    expect(isFilterActive({ query: '   ', categoryId: null })).toBe(false);
  });

  it('filters by category and combines with the query', () => {
    expect(cardMatches(card, { query: '', categoryId: 'cat-bug' })).toBe(true);
    expect(cardMatches(card, { query: '', categoryId: 'cat-feature' })).toBe(false);
    expect(cardMatches({ ...card, category_id: null }, { query: '', categoryId: 'cat-bug' })).toBe(false);
    expect(cardMatches(card, { query: 'signup', categoryId: 'cat-bug' })).toBe(false);
  });
});
