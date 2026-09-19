-- Storage: board snapshot thumbnails (see app/src/app/core/board-snapshots.ts).
-- Objects are stored as `<board_id>/<variant>.webp` — board_id as the path's
-- first folder segment, so RLS can reuse board_role() exactly like every
-- table in the initial migration. Private bucket: the app always reads
-- through the authenticated `.download()` call, never a public URL.

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
