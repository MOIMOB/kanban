// Hand-written to match /supabase/schema.sql. Update when the schema changes.

export interface Database {
  public: {
    Tables: {
      kanban_profiles: {
        Row: { id: string; email: string; user_id: string | null; updated_at: string };
        Insert: { id: string; email: string; user_id?: string | null; updated_at?: string };
        Update: { id?: string; email?: string; user_id?: string | null; updated_at?: string };
        Relationships: [];
      };
      kanban_boards: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
          user_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
          user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
          user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      kanban_categories: {
        Row: {
          id: string;
          name: string;
          color: string;
          owner_id: string;
          created_at: string;
          user_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          owner_id: string;
          created_at?: string;
          user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          owner_id?: string;
          created_at?: string;
          user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      kanban_board_members: {
        Row: { board_id: string; user_id: string; role: 'editor' | 'viewer'; updated_at: string };
        Insert: {
          board_id: string;
          user_id: string;
          role: 'editor' | 'viewer';
          updated_at?: string;
        };
        Update: {
          board_id?: string;
          user_id?: string;
          role?: 'editor' | 'viewer';
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kanban_board_members_board_id_fkey';
            columns: ['board_id'];
            isOneToOne: false;
            referencedRelation: 'kanban_boards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'kanban_board_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'kanban_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      kanban_columns: {
        Row: {
          id: string;
          board_id: string;
          name: string;
          position: number;
          user_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          name: string;
          position: number;
          user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          board_id?: string;
          name?: string;
          position?: number;
          user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kanban_columns_board_id_fkey';
            columns: ['board_id'];
            isOneToOne: false;
            referencedRelation: 'kanban_boards';
            referencedColumns: ['id'];
          },
        ];
      };
      kanban_cards: {
        Row: {
          id: string;
          column_id: string;
          title: string;
          description: string | null;
          due_date: string | null;
          position: number;
          created_at: string;
          category_id: string | null;
          user_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          column_id: string;
          title: string;
          description?: string | null;
          due_date?: string | null;
          position: number;
          created_at?: string;
          category_id?: string | null;
          user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          column_id?: string;
          title?: string;
          description?: string | null;
          due_date?: string | null;
          position?: number;
          created_at?: string;
          category_id?: string | null;
          user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kanban_cards_column_id_fkey';
            columns: ['column_id'];
            isOneToOne: false;
            referencedRelation: 'kanban_columns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'kanban_cards_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'kanban_categories';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      find_user_id_by_email: {
        Args: { lookup_email: string };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
