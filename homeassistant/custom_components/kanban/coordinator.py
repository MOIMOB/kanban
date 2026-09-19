"""DataUpdateCoordinator that polls one Supabase kanban board."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import KanbanApiClient, KanbanApiError
from .const import DOMAIN, SCAN_INTERVAL

_LOGGER = logging.getLogger(__name__)


@dataclass
class KanbanColumn:
    id: str
    name: str
    position: int
    cards: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class KanbanBoardState:
    columns: list[KanbanColumn]


class KanbanCoordinator(DataUpdateCoordinator[KanbanBoardState]):
    """Fetches columns + cards for a board on a fixed interval."""

    def __init__(self, hass: HomeAssistant, api: KanbanApiClient, board_id: str) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN, update_interval=SCAN_INTERVAL)
        self.api = api
        self.board_id = board_id

    async def _async_update_data(self) -> KanbanBoardState:
        try:
            columns = await self.api.get_columns(self.board_id)
            cards = await self.api.get_cards(self.board_id)
        except KanbanApiError as err:
            raise UpdateFailed(str(err)) from err

        by_column: dict[str, list[dict[str, Any]]] = {}
        for card in cards:
            by_column.setdefault(card["column_id"], []).append(card)
        for column_cards in by_column.values():
            column_cards.sort(key=lambda c: c["position"])

        return KanbanBoardState(
            columns=[
                KanbanColumn(
                    id=col["id"],
                    name=col["name"],
                    position=col["position"],
                    cards=by_column.get(col["id"], []),
                )
                for col in columns
            ]
        )
