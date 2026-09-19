# Kanban — web app

Angular 22 (standalone components, signals, no NgRx) + Supabase, styled with
Tailwind CSS. Static SPA — no SSR. Installable as a PWA (service worker +
manifest via `@angular/pwa`); each board also gets a thumbnail on the boards
list, captured on the way out of the board page and stored in a Supabase
Storage bucket (see `core/board-snapshots.ts`).

## Setup

1. Get a Supabase backend running — see [../supabase/README.md](../supabase/README.md).
   Easiest for local dev: `cd ../supabase && npm install && npm start` (needs
   Docker), which prints a URL + anon key. You'll need those either way,
   whether local or a real remote project.
2. Copy the runtime config template and fill it in:
   ```
   cp public/env.example.js public/env.js
   ```
   Edit `public/env.js` with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
   This file is gitignored — it holds your project's values, not secrets
   (the anon key is safe in the browser; Row Level Security does the actual
   protecting).
3. Install tooling and dependencies:
   ```
   mise install   # pins Node — see mise.toml at the repo root
   npm install
   ```
4. Run it:
   ```
   npm start
   ```
   → http://localhost:4200

## Why a runtime `env.js` instead of Angular environment files

Config is read from `window.__env` (set by `public/env.js`, loaded via a
`<script>` tag before the app bundle) rather than baked in at build time.
That means the same build artifact works for local dev, Netlify, and a
self-hosted Docker deployment — you only ever change `env.js`, never rebuild.

## Scripts

| Command | What |
| --- | --- |
| `npm start` | Dev server at :4200 |
| `npm run build` | Production build → `dist/app` |
| `npm test` | Unit tests (Vitest), watch mode |
| `npm run test:ci` | Unit tests, run once |
| `npm run e2e` | Cypress e2e, headless (needs `npm start` running separately, or use `e2e:open`) |
| `npm run e2e:open` | Cypress interactive runner |

## Testing notes

- Unit tests cover the auth guard and the card-ordering logic in
  `BoardDetailService`; they don't hit Supabase.
- The Cypress golden-path spec (`cypress/e2e/golden-path.cy.ts`) stubs every
  Supabase call with `cy.intercept`, so it runs against `public/env.example.js`
  placeholder values — no real Supabase project needed. It covers sign in →
  create board → add a card → share the board. Drag-and-drop card reordering
  isn't exercised end-to-end (Angular CDK drag events are awkward to simulate
  reliably in Cypress); the reordering algorithm itself has unit coverage
  instead.

## Project structure

```
src/app/
  core/            Supabase client, auth service/guard, shared models,
                   theme service, board-snapshots (thumbnail storage config)
  features/
    auth/          Login/signup page
    boards/        Boards list + create/edit/delete dialogs
    board-detail/  Columns, cards, drag-and-drop, sharing dialog,
                   board-snapshot.guard (captures a thumbnail on the way out)
```

## Deploying

**Netlify**: the root [`netlify.toml`](../netlify.toml) handles this — connect
the repo, set two build environment variables in the Netlify UI
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`), and Netlify's build writes
`public/env.js` from them before running `ng build`. That's the same
runtime-config file described above, just generated at build time from env
vars instead of hand-edited — `env.js` itself stays gitignored either way.

**Docker**: not built yet — see the root README's known limitations. A
static SPA behind nginx is the natural shape; contributions welcome.
