export type BoardRole = 'owner' | 'editor' | 'viewer';

export interface Board {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  created_at: string;
}

export interface BoardWithRole extends Board {
  role: BoardRole;
}

export interface BoardMember {
  board_id: string;
  user_id: string;
  email: string;
  role: Exclude<BoardRole, 'owner'>;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
}

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  category_id: string | null;
}
