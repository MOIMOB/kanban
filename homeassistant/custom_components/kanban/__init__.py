"""The Kanban Board integration."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import KanbanApiClient
from .const import (
    ATTR_CARD_ID,
    ATTR_COLUMN_ID,
    ATTR_TITLE,
    CONF_BOARD_ID,
    CONF_SERVICE_ROLE_KEY,
    CONF_SUPABASE_URL,
    DOMAIN,
    SERVICE_ADD_CARD,
    SERVICE_DELETE_CARD,
    SERVICE_MOVE_CARD,
)
from .coordinator import KanbanCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR]

MOVE_CARD_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CARD_ID): cv.string,
        vol.Required(ATTR_COLUMN_ID): cv.string,
        vol.Optional("position", default=0): cv.positive_int,
    }
)
ADD_CARD_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_COLUMN_ID): cv.string,
        vol.Required(ATTR_TITLE): cv.string,
    }
)
DELETE_CARD_SCHEMA = vol.Schema({vol.Required(ATTR_CARD_ID): cv.string})


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    session = async_get_clientsession(hass)
    api = KanbanApiClient(
        session, entry.data[CONF_SUPABASE_URL], entry.data[CONF_SERVICE_ROLE_KEY]
    )
    coordinator = KanbanCoordinator(hass, api, entry.data[CONF_BOARD_ID])
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    _async_register_services(hass, api, coordinator)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unloaded


def _async_register_services(
    hass: HomeAssistant, api: KanbanApiClient, coordinator: KanbanCoordinator
) -> None:
    if hass.services.has_service(DOMAIN, SERVICE_MOVE_CARD):
        return

    async def move_card(call: ServiceCall) -> None:
        await api.move_card(call.data[ATTR_CARD_ID], call.data[ATTR_COLUMN_ID], call.data["position"])
        await coordinator.async_request_refresh()

    async def add_card(call: ServiceCall) -> None:
        await api.add_card(call.data[ATTR_COLUMN_ID], call.data[ATTR_TITLE], position=0)
        await coordinator.async_request_refresh()

    async def delete_card(call: ServiceCall) -> None:
        await api.delete_card(call.data[ATTR_CARD_ID])
        await coordinator.async_request_refresh()

    hass.services.async_register(DOMAIN, SERVICE_MOVE_CARD, move_card, schema=MOVE_CARD_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_ADD_CARD, add_card, schema=ADD_CARD_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_DELETE_CARD, delete_card, schema=DELETE_CARD_SCHEMA)
