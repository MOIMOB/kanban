"""Config flow for the Kanban Board integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import KanbanApiClient, KanbanApiError
from .const import CONF_BOARD_ID, CONF_BOARD_NAME, CONF_SERVICE_ROLE_KEY, CONF_SUPABASE_URL, DOMAIN

STEP_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_SUPABASE_URL): str,
        vol.Required(CONF_SERVICE_ROLE_KEY): str,
        vol.Required(CONF_BOARD_ID): str,
        vol.Optional(CONF_BOARD_NAME, default="Kanban"): str,
    }
)


async def _validate(hass: HomeAssistant, data: dict[str, Any]) -> None:
    session = async_get_clientsession(hass)
    api = KanbanApiClient(session, data[CONF_SUPABASE_URL], data[CONF_SERVICE_ROLE_KEY])
    await api.get_columns(data[CONF_BOARD_ID])


class KanbanConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Kanban Board."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_BOARD_ID])
            self._abort_if_unique_id_configured()
            try:
                await _validate(self.hass, user_input)
            except KanbanApiError:
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(title=user_input[CONF_BOARD_NAME], data=user_input)

        return self.async_show_form(step_id="user", data_schema=STEP_USER_SCHEMA, errors=errors)
