"""Constants for the Kanban Board integration."""

from datetime import timedelta

DOMAIN = "kanban"

CONF_SUPABASE_URL = "supabase_url"
CONF_SERVICE_ROLE_KEY = "service_role_key"  # legacy name; holds anon or service_role key
CONF_EMAIL = "email"
CONF_PASSWORD = "password"

CARD_URL_PATH = "/kanban_static/kanban-card.js"
CONF_BOARD_ID = "board_id"
CONF_BOARD_NAME = "board_name"

SCAN_INTERVAL = timedelta(seconds=30)

ATTR_CARDS = "cards"
ATTR_COLUMN_ID = "column_id"
ATTR_CARD_ID = "card_id"
ATTR_TITLE = "title"
ATTR_DESCRIPTION = "description"
ATTR_DUE_DATE = "due_date"
ATTR_POSITION = "position"

SERVICE_MOVE_CARD = "move_card"
SERVICE_ADD_CARD = "add_card"
SERVICE_DELETE_CARD = "delete_card"
