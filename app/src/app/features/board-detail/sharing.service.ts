import { Injectable, signal } from '@angular/core';
import { getSupabase } from '../../core/supabase.client';
import type { BoardMember } from '../../core/models';

@Injectable()
export class SharingService {
  private readonly supabase = getSupabase();

  readonly members = signal<BoardMember[]>([]);
  readonly loading = signal(false);

  async load(boardId: string): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('kanban_board_members')
        .select('board_id, user_id, role, kanban_profiles(email)')
        .eq('board_id', boardId);
      if (error) throw error;
      this.members.set(
        (data as any[]).map((row) => ({
          board_id: row.board_id,
          user_id: row.user_id,
          role: row.role,
          email: row.kanban_profiles?.email ?? '(unknown)',
        })),
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** Adds a collaborator by email. Access is granted immediately, no invite step. */
  async addMember(boardId: string, email: string, role: 'editor' | 'viewer'): Promise<void> {
    const { data: userId, error: lookupError } = await this.supabase.rpc(
      'find_user_id_by_email',
      { lookup_email: email },
    );
    if (lookupError) throw lookupError;
    if (!userId) throw new Error(`No account found for ${email}`);

    const { error } = await this.supabase
      .from('kanban_board_members')
      .upsert({ board_id: boardId, user_id: userId, role }, { onConflict: 'board_id,user_id' });
    if (error) throw error;
    await this.load(boardId);
  }

  async updateRole(boardId: string, userId: string, role: 'editor' | 'viewer'): Promise<void> {
    const { error } = await this.supabase
      .from('kanban_board_members')
      .update({ role })
      .eq('board_id', boardId)
      .eq('user_id', userId);
    if (error) throw error;
    this.members.update((m) => m.map((x) => (x.user_id === userId ? { ...x, role } : x)));
  }

  async removeMember(boardId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('kanban_board_members')
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', userId);
    if (error) throw error;
    this.members.update((m) => m.filter((x) => x.user_id !== userId));
  }
}
