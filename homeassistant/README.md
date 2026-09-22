# Kanban — Home Assistant integration

Two pieces:

- **`custom_components/kanban`** — a Python integration that polls one board
  from your Supabase project and exposes it to Home Assistant as sensors +
  services.
- **`lovelace-card`** — a custom Lovelace card that mirrors the board and
  lets you move cards by tapping them.

## Security model

The Lovelace card never talks to Supabase directly. It only calls Home
Assistant (services + reads entity state); the Python `custom_component` is
the only thing that holds Supabase credentials, and it holds the
**service_role** key — not the app's anon key.

Why service_role and not anon-key-plus-RLS like the web app: RLS policies
are scoped to `auth.uid()`, i.e. a signed-in Supabase user. Home Assistant
isn't a Supabase-authenticated user — it's a trusted backend you configured
once with a specific `board_id`. service_role bypasses RLS entirely, which
is standard for a server-side integration acting on behalf of its owner,
not a public client. Practical implication: **treat your Supabase
service_role key like a root password.** It's entered once in the HA config
flow and stored in HA's own encrypted config storage; it never reaches a
browser or the Lovelace card.

## Installing the integration

**Manual install only for now** (see the root README's known limitations —
this is HACS-compatible in structure but not yet submitted to HACS):

1. Copy `custom_components/kanban` into your Home Assistant config's
   `custom_components/` folder, so you end up with
   `<config>/custom_components/kanban/manifest.json`.
2. Restart Home Assistant.
3. **Settings → Devices & Services → Add Integration → Kanban Board.**
4. Fill in:
   - **Supabase project URL** — e.g. `https://xxxx.supabase.co`
   - **Supabase API key** — Settings → API. Use the **anon key** together
     with email/password (recommended; RLS applies as that user). Or leave
     email/password empty and use the **service_role** key.
   - **Email / Password** — your web-app login
   - **Board ID** — open the board in the web app; the id is in the URL
     (`/boards/<this-part>`)
   - **Board name** — just a label for the HA entities

This creates one `sensor.<column name>` entity per column. Each sensor's
state is the card count; `cards` in its attributes is the list of cards
(id, title, description, due_date), for use in templates or the Lovelace
card.

Polling runs every 30 seconds (`const.py: SCAN_INTERVAL`) — no websocket
bridge to Supabase Realtime yet, so there's up to ~30s lag between a change
in the web app and it showing up in Home Assistant. See the root README's
known limitations.

### Services

| Service | Fields | What |
| --- | --- | --- |
| `kanban.move_card` | `card_id`, `column_id`, `position` | Moves a card to a column |
| `kanban.add_card` | `column_id`, `title` | Adds a card (lands at the top of the column) |
| `kanban.delete_card` | `card_id` | Deletes a card |

These are ordinary HA services — usable from automations, scripts, or a
voice assistant intent, not just the Lovelace card. Example: "add grocery
run to my To Do list" → an automation matching that sentence calling
`kanban.add_card` with the right `column_id`.

## Installing the Lovelace card

The card JS ships inside the integration (`custom_components/kanban/www/kanban-card.js`)
and is served + auto-loaded by it — no resource to add. Just add the card to a
dashboard (YAML mode, or "Manual card" in the UI):

1. (Only if you change the card source) rebuild — output goes straight into the integration:
   ```
   cd lovelace-card
   mise install
   npm install
   npm run build
   ```
2. Add the card:
   ```yaml
   type: custom:kanban-card
   title: Groceries
   entities:
     - sensor.to_do
     - sensor.doing
     - sensor.done
   ```
   List the column sensors in the order you want them displayed.

Tap a card to open a small menu of the other columns and move it there.
There's no drag-and-drop here — see the root README's known limitations for
why (short version: reliable drag-and-drop in a custom Lovelace card,
especially on touch, is a lot more surface area than a v1 warranted; the web
app has full drag-and-drop).

## Development

```
mise install                       # pins Python — see ../mise.toml
python -m venv .venv
.venv/bin/pip install -r requirements-test.txt   # Windows: .venv\Scripts\pip
pytest -q
```

Tests cover `api.py` (the Supabase REST client) against a mocked HTTP layer
— they don't import Home Assistant core, so they're fast and don't need the
full HA test harness. `config_flow.py`, `coordinator.py`, and `sensor.py`
aren't unit-tested yet; they're straightforward enough to review by reading,
but real HA-harness tests (`pytest-homeassistant-custom-component`) would be
a good contribution.
