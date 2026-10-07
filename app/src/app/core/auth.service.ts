import { Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = getSupabase();

  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);

  constructor() {
    this.supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
      this.ready.set(true);
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
    });
  }

  /** Resolves once the initial session has been restored. */
  async whenReady(): Promise<void> {
    while (!this.ready()) await new Promise((resolve) => setTimeout(resolve, 20));
  }

  async signUp(email: string, password: string) {
    const { error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Set eagerly so a guard re-run right after sign-in sees the user.
    if (data?.session) {
      this.session.set(data.session);
      this.user.set(data.session.user);
    }
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  /** Re-fetches the user from Supabase instead of trusting the cached signal. */
  async currentUserId(): Promise<string | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return user?.id ?? null;
  }
}
