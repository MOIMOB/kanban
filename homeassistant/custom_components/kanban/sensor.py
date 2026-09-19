"""One sensor entity per kanban column, state = card count."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import ATTR_CARDS, CONF_BOARD_ID, CONF_BOARD_NAME, DOMAIN
from .coordinator import KanbanColumn, KanbanCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: KanbanCoordinator = hass.data[DOMAIN][entry.entry_id]
    board_id = entry.data[CONF_BOARD_ID]
    board_name = entry.data.get(CONF_BOARD_NAME, "Kanban")

    known_column_ids: set[str] = set()

    def sync_entities() -> None:
        new_columns = [c for c in coordinator.data.columns if c.id not in known_column_ids]
        if not new_columns:
            return
        known_column_ids.update(c.id for c in new_columns)
        async_add_entities(
            KanbanColumnSensor(coordinator, board_id, board_name, col.id) for col in new_columns
        )

    sync_entities()
    entry.async_on_unload(coordinator.async_add_listener(sync_entities))


class KanbanColumnSensor(CoordinatorEntity[KanbanCoordinator], SensorEntity):
    """Card count for one column, with the cards as an attribute."""

    _attr_has_entity_name = True
    _attr_native_unit_of_measurement = "cards"
    _attr_icon = "mdi:view-column"

    def __init__(
        self, coordinator: KanbanCoordinator, board_id: str, board_name: str, column_id: str
    ) -> None:
        super().__init__(coordinator)
        self._board_id = board_id
        self._column_id = column_id
        self._attr_unique_id = f"kanban_{board_id}_{column_id}"

    def _column(self) -> KanbanColumn | None:
        return next((c for c in self.coordinator.data.columns if c.id == self._column_id), None)

    @property
    def name(self) -> str | None:
        column = self._column()
        return column.name if column else None

    @property
    def native_value(self) -> int:
        column = self._column()
        return len(column.cards) if column else 0

    @property
    def extra_state_attributes(self) -> dict:
        column = self._column()
        if not column:
            return {}
        return {
            "column_id": column.id,
            "board_id": self._board_id,
            ATTR_CARDS: [
                {
                    "id": card["id"],
                    "title": card["title"],
                    "description": card.get("description"),
                    "due_date": card.get("due_date"),
                    "position": card["position"],
                }
                for card in column.cards
            ],
        }
