import type { Card } from '../../core/models';

export interface CardFilter {
  /** Free text matched against title, description and category name. */
  query: string;
  /** Only cards in this category; null = any. */
  categoryId: string | null;
}

export const EMPTY_FILTER: CardFilter = { query: '', categoryId: null };

export const isFilterActive = (filter: CardFilter) => filter.query.trim() !== '' || filter.categoryId !== null;

export function cardMatches(card: Card, filter: CardFilter, categoryName: string | null = null): boolean {
  if (filter.categoryId !== null && card.category_id !== filter.categoryId) return false;
  const query = filter.query.trim().toLowerCase();
  if (!query) return true;
  return [card.title, card.description, categoryName].some((text) => text?.toLowerCase().includes(query));
}
