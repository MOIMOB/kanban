# Contributing

Thanks for considering it. This is a small project with three moving parts —
pick whichever one your change touches.

## Setup

Everything is pinned via [mise](https://mise.jdx.dev) — `mise install` at
the repo root picks up Node and Python. Package management is npm
throughout (JS/TS subprojects); Python deps are plain `pip` + a
`requirements-test.txt`.

- **`/app`** (Angular): see [app/README.md](app/README.md).
- **`/supabase`**: see [supabase/README.md](supabase/README.md).
- **`/homeassistant`**: see [homeassistant/README.md](homeassistant/README.md).

## Before opening a PR

- `app`: `npm run test:ci` and `npm run build` should pass. If you touched
  UI behavior, `npm run e2e` too.
- `homeassistant`: `pytest -q`.
- `homeassistant/lovelace-card`: `npx tsc --noEmit && npm run build`.
- If you change `supabase/schema.sql`, update
  `app/src/app/core/database.types.ts` to match (see
  [supabase/README.md](supabase/README.md#keeping-the-apps-typescript-types-in-sync)).

CI runs all of the above on every PR — see
[.github/workflows/ci.yml](.github/workflows/ci.yml).

## Scope for this project

It's deliberately small — see the root README's "Known limitations" for
what's out of scope for now (HACS submission, Docker, SSR, Supabase Realtime
in the HA integration, drag-and-drop in the Lovelace card). PRs picking one
of those up are welcome; PRs adding unrelated scope (new card fields,
notifications, etc.) are worth opening an issue to discuss first.

## Commit / PR style

Small, focused commits. Explain *why* in the commit message or PR
description if it's not obvious from the diff.
