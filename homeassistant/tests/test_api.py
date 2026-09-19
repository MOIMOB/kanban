"""Tests for the Supabase REST client, mocking the HTTP layer with aioresponses."""

import pytest
from aiohttp import ClientSession
from aioresponses import aioresponses

from kanban_api import KanbanApiClient, KanbanApiError

BASE = "https://project.supabase.co"


@pytest.fixture
async def api():
    async with ClientSession() as session:
        yield KanbanApiClient(session, BASE, "service-role-key")


async def test_get_columns_orders_by_position(api: KanbanApiClient):
    with aioresponses() as mocked:
        mocked.get(
            f"{BASE}/rest/v1/kanban_columns?board_id=eq.board-1&select=%2A&order=position",
            payload=[{"id": "col-1", "name": "To Do", "position": 0}],
        )
        columns = await api.get_columns("board-1")
    assert columns == [{"id": "col-1", "name": "To Do", "position": 0}]


async def test_move_card_sends_patch(api: KanbanApiClient):
    with aioresponses() as mocked:
        mocked.patch(f"{BASE}/rest/v1/kanban_cards?id=eq.card-1", status=204)
        await api.move_card("card-1", "col-2", 3)

    key = next(k for k in mocked.requests if k[0] == "PATCH")
    request = mocked.requests[key][0]
    assert request.kwargs["json"] == {"column_id": "col-2", "position": 3}


async def test_add_card_returns_created_row(api: KanbanApiClient):
    with aioresponses() as mocked:
        mocked.post(
            f"{BASE}/rest/v1/kanban_cards",
            payload=[{"id": "card-9", "column_id": "col-1", "title": "New", "position": 0}],
        )
        card = await api.add_card("col-1", "New", 0)
    assert card["id"] == "card-9"


async def test_raises_on_http_error(api: KanbanApiClient):
    with aioresponses() as mocked:
        mocked.get(
            f"{BASE}/rest/v1/kanban_columns?board_id=eq.bad&select=%2A&order=position",
            status=403,
            body="permission denied",
        )
        with pytest.raises(KanbanApiError):
            await api.get_columns("bad")
