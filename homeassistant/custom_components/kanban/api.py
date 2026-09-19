"""Thin async client for the Supabase REST (PostgREST) API.

Uses the project's service_role key, which bypasses Row Level Security. That's
intentional here: this integration is a trusted server-side component that the
user explicitly pointed at one board_id in the config flow, not a multi-tenant
client — see /homeassistant/README.md for the security rationale.
"""

from __future__ import annotations

from typing import Any

from aiohttp import ClientSession


class KanbanApiError(Exception):
    """Raised when the Supabase REST API returns an error."""


class KanbanApiClient:
    """Talks to a Supabase project's PostgREST endpoint for one board."""

    def __init__(self, session: ClientSession, supabase_url: str, service_role_key: str) -> None:
        self._session = session
        self._base_url = supabase_url.rstrip("/") + "/rest/v1"
        self._headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    async def get_columns(self, board_id: str) -> list[dict[str, Any]]:
        params = {"board_id": f"eq.{board_id}", "select": "*", "order": "position"}
        return await self._request("GET", "/kanban_columns", params=params)

    async def get_cards(self, board_id: str) -> list[dict[str, Any]]:
        params = {
            "select": "*,kanban_columns!inner(board_id)",
            "kanban_columns.board_id": f"eq.{board_id}",
            "order": "position",
        }
        return await self._request("GET", "/kanban_cards", params=params)

    async def move_card(self, card_id: str, column_id: str, position: int) -> None:
        params = {"id": f"eq.{card_id}"}
        await self._request(
            "PATCH",
            "/kanban_cards",
            params=params,
            json={"column_id": column_id, "position": position},
        )

    async def add_card(self, column_id: str, title: str, position: int) -> dict[str, Any]:
        body = {"column_id": column_id, "title": title, "position": position}
        result = await self._request(
            "POST", "/kanban_cards", json=body, extra_headers={"Prefer": "return=representation"}
        )
        return result[0] if result else {}

    async def delete_card(self, card_id: str) -> None:
        params = {"id": f"eq.{card_id}"}
        await self._request("DELETE", "/kanban_cards", params=params)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json: dict[str, Any] | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        headers = {**self._headers, **(extra_headers or {})}
        async with self._session.request(
            method, self._base_url + path, headers=headers, params=params, json=json
        ) as resp:
            if resp.status >= 400:
                text = await resp.text()
                raise KanbanApiError(f"{method} {path} failed ({resp.status}): {text}")
            if resp.content_length == 0 or resp.status == 204:
                return []
            return await resp.json()
