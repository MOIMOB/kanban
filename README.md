# Kanban

An open source, self-hosted, simple kanban board. Boards, columns, cards,
sharing and live updates, built with Angular + Supabase. Runs on your own
infrastructure, with a Home Assistant integration so you can see and move cards
from a wall-mounted tablet or a voice command, not just the browser.

[![CI](https://github.com/MOIMOB/kanban/actions/workflows/ci.yml/badge.svg)](https://github.com/MOIMOB/kanban/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What's here

| Path | What | Docs |
| --- | --- | --- |
| `/app` | The Angular web app (boards, columns, cards, sharing) | [app/README.md](app/README.md) |
| `/supabase` | Database schema, RLS policies, realtime setup | [supabase/README.md](supabase/README.md) |
| `/homeassistant` | Custom component + Lovelace card | [homeassistant/README.md](homeassistant/README.md) |

## Feature overview

- Multiple boards, each with user-configurable columns and drag-and-drop cards.
- Multi-user via Supabase Auth. A board owner shares a board by adding a
  collaborator's email directly and picking a role (**editor** or **viewer**)
  — access is granted immediately, no invite/accept step.
- Live updates across everyone viewing a board, via Supabase Realtime.
- Installable as a PWA, with a thumbnail preview of each board on the boards
  list (captured client-side, stored in a private Supabase Storage bucket).
- A Home Assistant integration that polls your board and exposes it as
  sensors + services, plus a Lovelace card that mirrors the board and lets
  you move cards by tapping them (see [homeassistant/README.md](homeassistant/README.md)
  for why tap-to-move instead of drag-and-drop there).

## Architecture

```
Angular app (Netlify)                Home Assistant
   │  REST + Realtime,                  custom_component
   │  anon key + RLS                        │  REST, service_role key
   ▼                                        ▼
        Supabase (Postgres, Auth, Realtime)
                                             ▲
                                             │  HA services + sensor state
                                             │
                                       Lovelace card
```

The Angular app talks to Supabase directly, protected entirely by Row Level
Security (see [supabase/schema.sql](supabase/schema.sql)) — the browser only
ever holds the public anon key. The Home Assistant integration is a separate,
trusted server-side client: it holds your Supabase **service_role** key
locally in your HA config and proxies reads/writes for the Lovelace card, so
that key never reaches a browser. See
[homeassistant/README.md](homeassistant/README.md#security-model) for the
reasoning.

## Quick start

1. **Supabase**: for local development, `cd supabase && npm install && npm start`
   runs a full local Postgres + Auth + Realtime stack in Docker (see
   [supabase/README.md](supabase/README.md)) — no remote project needed. For a
   real deployment, create a project at supabase.com and run
   [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor instead.
2. **App**: `cd app`, copy `public/env.example.js` to `public/env.js` with
   the Supabase URL + anon key (local `supabase start` prints these; a remote
   project has them under Settings → API), `npm install`, `npm start`. See
   [app/README.md](app/README.md).
3. **Home Assistant** (optional): copy `homeassistant/custom_components/kanban`
   into your HA `custom_components/`, restart HA, add the integration via the
   UI. Then add the Lovelace card. See [homeassistant/README.md](homeassistant/README.md).

## Tooling

This repo pins its Node and Python versions with [mise](https://mise.jdx.dev)
(`mise.toml` at the repo root — `mise install` picks them up). Package
management is npm throughout.

## Known limitations (v1)

- The Home Assistant integration polls every 30s rather than subscribing to
  Supabase Realtime — simpler to build and reason about; a websocket bridge
  is a natural follow-up.
- The Lovelace card is tap-to-move, not drag-and-drop.
- The HA custom_component is manual-install only; it's structured to be
  HACS-compatible but hasn't been submitted to HACS yet.
- No SSR — the app is a static SPA. If this ever grows a public marketing
  page, that page would likely want SSR; the authenticated board views
  wouldn't.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

## Demo mode

Set `DEMO_MODE=true` (build-time env var) to build a Supabase-free version: login is skipped,
data is kept in the browser's localStorage (snapshots in IndexedDB), and a banner marks the app as a demo.
On Netlify, create a second site from this repo and set `DEMO_MODE=true` in its environment
(`SUPABASE_*` not needed). Locally, put `DEMO_MODE: 'true'` in `app/public/env.js`.
Sharing is unavailable in demo mode.
