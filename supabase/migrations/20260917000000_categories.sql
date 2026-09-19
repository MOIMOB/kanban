-- Card categories: a personal set of colored tags the board owner applies to
-- their own cards (e.g. "Bug" in red). `kanban_categories` rows are only
-- readable/writable by their owner, and `kanban_cards.category_id` is only
-- ever set by whoever has editor/owner access on the card's board — so a
-- collaborator who can't resolve a category_id to a name/color just sees
-- that card as uncategorized in their own view, which is fine since
-- categories exist to organize the owner's own tagging scheme.

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

alter table public.kanban_cards
  add column if not exists category_id uuid references public.kanban_categories (id) on delete set null;

alter table public.kanban_categories enable row level security;

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
