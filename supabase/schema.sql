-- Kanban schema for Supabase.
-- Run in the Supabase SQL editor (or via `supabase db push` with this file as
-- a migration). Safe to re-run — every statement is idempotent. See
-- /supabase/README.md for setup.
--
-- Tables are prefixed `kanban_` so this can share a Supabase project with
-- other apps without name collisions.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- `user_id`/`updated_at` below aren't used by this app's own read paths (no
-- query filters or displays them) — they exist because this project has a
-- pre-existing mechanism (an event trigger, most likely) that auto-attaches
-- "stamp user_id / bump updated_at" triggers to every new table, which
-- errors on insert if those columns are missing. Rather than depend on that
-- trigger (or fight it), the app explicitly supplies `user_id` itself on
-- every insert into these tables (see BoardsService/BoardDetailService) —
-- so this works the same whether or not that trigger is actually attached.
-- The one exception is `kanban_board_members`, whose `user_id` already
-- means "the collaborator being granted access", not the acting user — see
-- the note after its CREATE TABLE.

create table if not exists public.kanban_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  user_id uuid references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.kanban_profiles add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.kanban_profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.kanban_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.kanban_boards add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.kanban_boards add column if not exists updated_at timestamptz not null default now();

-- Card categories: a personal set of colored tags the board owner applies to
-- their own cards (e.g. "Bug" in red). `kanban_categories` rows are only
-- readable by their owner, and `kanban_cards.category_id` is only ever set
-- by whoever has editor/owner access on the card's board — so a collaborator
-- who can't resolve a category_id to a name/color just sees that card as
-- uncategorized in their own view, which is fine since categories exist to
-- organize the owner's own tagging scheme.
create table if not exists public.kanban_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#6366f1',
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.kanban_categories add column if not exists color text not null default '#6366f1';
alter table public.kanban_categories add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.kanban_categories add column if not exists updated_at timestamptz not null default now();

create table if not exists public.kanban_board_members (
  board_id uuid not null references public.kanban_boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  updated_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
alter table public.kanban_board_members add column if not exists updated_at timestamptz not null default now();
-- kanban_board_members.user_id already means "the collaborator" — the app
-- never lets anything else write it, and the trigger-drop DO block below
-- still strips any auto-attached trigger from this table specifically, so
-- it can't get silently overwritten with the caller's id instead.

create table if not exists public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.kanban_boards (id) on delete cascade,
  name text not null,
  position int not null default 0,
  user_id uuid references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.kanban_columns add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.kanban_columns add column if not exists updated_at timestamptz not null default now();

create table if not exists public.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.kanban_columns (id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.kanban_cards add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.kanban_cards add column if not exists updated_at timestamptz not null default now();
alter table public.kanban_cards
  add column if not exists category_id uuid references public.kanban_categories (id) on delete set null;

-- Drop any auto-attached "stamp user_id" trigger from kanban_board_members
-- specifically (the one table where the app doesn't supply user_id itself
-- and can't let a foreign trigger overwrite it). Matches on the trigger
-- function's body referencing NEW.user_id, whatever it's actually named.
do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.kanban_board_members'::regclass
      and not t.tgisinternal
      and pg_get_functiondef(p.oid) ilike '%new.user_id%'
  loop
    execute format('drop trigger if exists %I on public.kanban_board_members', r.tgname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Keep a profile row (id, email) in sync with auth.users, so board owners can
-- look collaborators up by email without querying auth.users directly.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.kanban_profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- board_role(board_id): the caller's role on a board, or null if they have
-- none. SECURITY DEFINER so it can read kanban_boards/kanban_board_members
-- without recursing into the RLS policies defined below (the standard
-- Supabase pattern for role-lookup helpers).
--
-- Gotcha this caused for us: a SELECT policy that calls a SECURITY DEFINER
-- function like this one can't be satisfied by `INSERT ... RETURNING`
-- (i.e. supabase-js's `.insert(...).select()`) for a row inserted by that
-- same statement — Postgres re-checks the SELECT policy against a snapshot
-- that doesn't include the current command's own not-yet-visible write, so
-- the function can't find the row and the check fails, even though the
-- INSERT's own WITH CHECK passed. A separate follow-up SELECT (a different
-- command) works fine. The app works around this by inserting without
-- `.select()` (client-generated ids, see BoardsService.createBoard /
-- BoardDetailService.addCard) rather than by changing this function.
-- ---------------------------------------------------------------------------

create or replace function public.board_role(target_board_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when exists (
      select 1 from public.kanban_boards where id = target_board_id and owner_id = auth.uid()
    ) then 'owner'
    else (
      select role from public.kanban_board_members
      where board_id = target_board_id and user_id = auth.uid()
    )
  end;
$$;

-- Looks up a user id by exact email match, for the "add collaborator by
-- email" flow. SECURITY DEFINER because kanban_profiles.email is not broadly
-- readable (see RLS below) but any signed-in user needs to be able to
-- resolve an email to an id when sharing a board they own.
create or replace function public.find_user_id_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.kanban_profiles where email = lookup_email;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.kanban_profiles enable row level security;
alter table public.kanban_boards enable row level security;
alter table public.kanban_categories enable row level security;
alter table public.kanban_board_members enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.kanban_cards enable row level security;

-- kanban_profiles: visible to yourself, and to anyone who shares a board
-- with you (so the share dialog can show collaborator emails).
drop policy if exists "profiles readable by board co-members" on public.kanban_profiles;
create policy "profiles readable by board co-members"
  on public.kanban_profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.kanban_board_members bm
      where bm.user_id = kanban_profiles.id and public.board_role(bm.board_id) is not null
    )
    or exists (
      select 1 from public.kanban_boards b
      where b.owner_id = kanban_profiles.id and public.board_role(b.id) is not null
    )
  );

-- kanban_boards: members (any role) can read; only the owner can create/update/delete.
drop policy if exists "boards readable by members" on public.kanban_boards;
create policy "boards readable by members" on public.kanban_boards for select
  using (public.board_role(id) is not null);

drop policy if exists "boards insertable by owner" on public.kanban_boards;
create policy "boards insertable by owner" on public.kanban_boards for insert
  with check (owner_id = auth.uid());

drop policy if exists "boards updatable by owner" on public.kanban_boards;
create policy "boards updatable by owner" on public.kanban_boards for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "boards deletable by owner" on public.kanban_boards;
create policy "boards deletable by owner" on public.kanban_boards for delete
  using (owner_id = auth.uid());

-- kanban_categories: personal to the owner, not shared with board co-members
-- (see the comment on the table's CREATE above).
drop policy if exists "categories readable by owner" on public.kanban_categories;
create policy "categories readable by owner" on public.kanban_categories for select
  using (owner_id = auth.uid());

drop policy if exists "categories insertable by owner" on public.kanban_categories;
create policy "categories insertable by owner" on public.kanban_categories for insert
  with check (owner_id = auth.uid());

drop policy if exists "categories updatable by owner" on public.kanban_categories;
create policy "categories updatable by owner" on public.kanban_categories for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "categories deletable by owner" on public.kanban_categories;
create policy "categories deletable by owner" on public.kanban_categories for delete
  using (owner_id = auth.uid());

-- kanban_board_members: any member can see the roster; only the owner manages it.
drop policy if exists "members readable by board members" on public.kanban_board_members;
create policy "members readable by board members" on public.kanban_board_members for select
  using (public.board_role(board_id) is not null);

drop policy if exists "members insertable by owner" on public.kanban_board_members;
create policy "members insertable by owner" on public.kanban_board_members for insert
  with check (public.board_role(board_id) = 'owner');

drop policy if exists "members updatable by owner" on public.kanban_board_members;
create policy "members updatable by owner" on public.kanban_board_members for update
  using (public.board_role(board_id) = 'owner') with check (public.board_role(board_id) = 'owner');

drop policy if exists "members deletable by owner" on public.kanban_board_members;
create policy "members deletable by owner" on public.kanban_board_members for delete
  using (public.board_role(board_id) = 'owner');

-- kanban_columns: any member can read; owner + editor can write.
drop policy if exists "columns readable by members" on public.kanban_columns;
create policy "columns readable by members" on public.kanban_columns for select
  using (public.board_role(board_id) is not null);

drop policy if exists "columns writable by editors" on public.kanban_columns;
create policy "columns writable by editors" on public.kanban_columns for insert
  with check (public.board_role(board_id) in ('owner', 'editor'));

drop policy if exists "columns updatable by editors" on public.kanban_columns;
create policy "columns updatable by editors" on public.kanban_columns for update
  using (public.board_role(board_id) in ('owner', 'editor'))
  with check (public.board_role(board_id) in ('owner', 'editor'));

drop policy if exists "columns deletable by editors" on public.kanban_columns;
create policy "columns deletable by editors" on public.kanban_columns for delete
  using (public.board_role(board_id) in ('owner', 'editor'));

-- kanban_cards: role is derived from the parent column's board.
drop policy if exists "cards readable by members" on public.kanban_cards;
create policy "cards readable by members" on public.kanban_cards for select
  using (
    public.board_role((select board_id from public.kanban_columns where id = kanban_cards.column_id)) is not null
  );

drop policy if exists "cards writable by editors" on public.kanban_cards;
create policy "cards writable by editors" on public.kanban_cards for insert
  with check (
    public.board_role((select board_id from public.kanban_columns where id = kanban_cards.column_id)) in ('owner', 'editor')
  );

drop policy if exists "cards updatable by editors" on public.kanban_cards;
create policy "cards updatable by editors" on public.kanban_cards for update
  using (
    public.board_role((select board_id from public.kanban_columns where id = kanban_cards.column_id)) in ('owner', 'editor')
  )
  with check (
    public.board_role((select board_id from public.kanban_columns where id = kanban_cards.column_id)) in ('owner', 'editor')
  );

drop policy if exists "cards deletable by editors" on public.kanban_cards;
create policy "cards deletable by editors" on public.kanban_cards for delete
  using (
    public.board_role((select board_id from public.kanban_columns where id = kanban_cards.column_id)) in ('owner', 'editor')
  );

-- ---------------------------------------------------------------------------
-- Storage: board snapshot thumbnails (see app/src/app/core/board-snapshots.ts).
-- Objects are stored as `<board_id>/<variant>.webp` — board_id as the path's
-- first folder segment, so RLS can reuse board_role() exactly like every
-- table above. Private bucket: the app always reads through the authenticated
-- `.download()` call, never a public URL.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('kanban-board-snapshots', 'kanban-board-snapshots', false)
on conflict (id) do nothing;

-- storage.objects ships with RLS already enabled on every Supabase project
-- (owned by supabase_storage_admin — a project-level role can't ALTER it
-- anyway), so there's nothing to toggle here, only policies to add.

drop policy if exists "board snapshots readable by members" on storage.objects;
create policy "board snapshots readable by members" on storage.objects for select
  using (
    bucket_id = 'kanban-board-snapshots'
    and public.board_role(((storage.foldername(name))[1])::uuid) is not null
  );

drop policy if exists "board snapshots insertable by editors" on storage.objects;
create policy "board snapshots insertable by editors" on storage.objects for insert
  with check (
    bucket_id = 'kanban-board-snapshots'
    and public.board_role(((storage.foldername(name))[1])::uuid) in ('owner', 'editor')
  );

drop policy if exists "board snapshots updatable by editors" on storage.objects;
create policy "board snapshots updatable by editors" on storage.objects for update
  using (
    bucket_id = 'kanban-board-snapshots'
    and public.board_role(((storage.foldername(name))[1])::uuid) in ('owner', 'editor')
  )
  with check (
    bucket_id = 'kanban-board-snapshots'
    and public.board_role(((storage.foldername(name))[1])::uuid) in ('owner', 'editor')
  );

drop policy if exists "board snapshots deletable by editors" on storage.objects;
create policy "board snapshots deletable by editors" on storage.objects for delete
  using (
    bucket_id = 'kanban-board-snapshots'
    and public.board_role(((storage.foldername(name))[1])::uuid) in ('owner', 'editor')
  );

-- ---------------------------------------------------------------------------
-- Realtime: broadcast changes so open boards update live for every viewer.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['kanban_boards', 'kanban_columns', 'kanban_cards', 'kanban_board_members']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
