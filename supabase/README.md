# Kanban — Supabase schema

## Local development (recommended while building)

Runs a full local Postgres + Auth + Realtime stack in Docker — same schema,
same app code, no dependency on any remote project. Needs
[Docker](https://www.docker.com/products/docker-desktop/) running.

```
cd supabase
npm install
npm start          # `supabase start` — first run pulls images, takes a bit
```

This applies every file in [`migrations/`](migrations) automatically (that's
the same content as [`schema.sql`](schema.sql) — see the note at the bottom
of this file on why both exist). Once it's up, the CLI prints a local API
URL, anon key, and a Studio URL (a local dashboard, same UI as the hosted
one). Copy the API URL + anon key into `app/public/env.js` — see
[../app/README.md](../app/README.md).

Other commands: `npm run stop`, `npm run status` (reprints the URLs/keys),
`npm run reset` (drops and re-applies all migrations — use after editing a
migration file).

## Remote project setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`schema.sql`](schema.sql) once. It's written
   for a fresh project; if you're editing an existing schema, read it before
   running (`create table if not exists`, but the policies and trigger use
   plain `create` / `drop ... if exists`).
3. In **Authentication → Providers**, make sure **Email** is enabled.
4. Grab your project URL and anon key from **Settings → API** — the web app
   needs those (see [../app/README.md](../app/README.md)).
5. For the Home Assistant integration, also grab the **service_role** key
   from the same page — see [../homeassistant/README.md](../homeassistant/README.md)
   for why it needs that instead of the anon key.

If you're pointing this at a Supabase project that already has other apps'
tables in it: this schema's tables are `kanban_`-prefixed specifically to
avoid name collisions, but if that project has its own conventions (e.g. an
event trigger that auto-instruments every new table with audit columns),
those can still interact with these tables in ways this README can't predict
— see the `user_id`/`updated_at` note below for the one case we've hit
ourselves.

## What's in `schema.sql`

Tables are prefixed `kanban_` so this schema can share a Supabase project
with other apps without name collisions (see [../app/README.md](../app/README.md)
if you're pointing this at an existing project).

- **Tables**: `kanban_profiles` (mirrors `auth.users`, so emails are
  queryable), `kanban_boards`, `kanban_categories` (a personal set of colored
  tags the owner applies to their own cards via `kanban_cards.category_id`;
  not shared with board co-members — see its RLS below), `kanban_board_members`
  (role = `editor` | `viewer`; the owner isn't a row here — `kanban_boards.owner_id` is
  authoritative), `kanban_columns`, `kanban_cards`. Most also carry a
  `user_id` and `updated_at` column that this app's own code doesn't read —
  they exist purely for compatibility with Supabase projects that
  auto-attach "stamp user_id / bump updated_at" triggers to every new table.
  The app explicitly supplies `user_id` itself on every insert (see
  `AuthService.currentUserId()`), so this works whether or not that trigger
  is actually present. `kanban_board_members` is the exception: its
  `user_id` already means "the collaborator being granted access", not the
  acting user, so `schema.sql` instead drops any auto-attached trigger from
  that one table specifically, to stop it clobbering that value.
- **`handle_new_user()` trigger**: keeps `kanban_profiles` in sync with
  `auth.users` on signup, so "share by email" can look someone up without
  querying `auth.users` directly (which client code can't read).
- **`board_role(board_id)`**: a `SECURITY DEFINER` helper returning the
  caller's role on a board (`owner` / `editor` / `viewer` / `null`). Every
  RLS policy below is built on this — it's what lets policies avoid
  recursively re-checking RLS on `kanban_boards`/`kanban_board_members`
  while looking up membership. (This helper function itself isn't
  table-prefixed — it's a function, not a table, so it doesn't collide the
  same way; rename it too if that bothers you.)
- **`find_user_id_by_email(email)`**: also `SECURITY DEFINER`, used by the
  "add collaborator by email" flow. Note this is a (deliberately) accepted
  email-existence oracle for any signed-in user — see the root README's
  design decisions if you want to tighten this later (e.g. rate-limiting, or
  requiring an accept step instead of immediate access).
- **RLS**: every table is members-only for reads; writes require `owner` or
  `editor` (except `kanban_board_members` itself and board metadata, which
  are `owner`-only). `kanban_categories` is the one exception to "members" —
  it's owner-only for read and write, full stop, since categories are the
  owner's personal tagging scheme for their own cards.
- **Realtime**: `kanban_boards`, `kanban_columns`, `kanban_cards`, and
  `kanban_board_members` are added to the `supabase_realtime` publication so
  the app gets live updates.
- **Storage**: a private `kanban-board-snapshots` bucket for board thumbnails
  (see `app/src/app/core/board-snapshots.ts`), with RLS on `storage.objects`
  built on `board_role()` the same way as the tables above — the board id is
  the object path's first folder segment, so a policy can check it without
  a separate lookup table.

## `schema.sql` vs `migrations/`

Both hold the same SQL — `migrations/<timestamp>_init.sql` is what the
Supabase CLI actually applies (`supabase db reset` re-applies everything in
`migrations/` in order); `schema.sql` is the same content kept at the top
level for copy-pasting into a remote project's dashboard SQL editor, for
people without the CLI/Docker. If you change the schema, edit both (or add a
new file to `migrations/` for the change and fold it into `schema.sql` too)
— there's no automation keeping them in sync.

## Keeping the app's TypeScript types in sync

`app/src/app/core/database.types.ts` is hand-written to match this schema
(supabase-js needs generic type parameters or every query call resolves to
`never`). If you change `schema.sql`, update that file too — or swap it for
`supabase gen types typescript --project-id <id> > app/src/app/core/database.types.ts`
if you'd rather generate it.
