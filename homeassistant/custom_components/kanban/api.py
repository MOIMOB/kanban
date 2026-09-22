"""Thin async client for the Supabase REST (PostgREST) API.

Two auth modes:
- email + password: signs in via Supabase Auth using the project's anon key,
  then acts as that user (Row Level Security applies). Preferred.
- API key only: uses the key as-is (e.g. service_role, which bypasses RLS) —
  see /homeassistant/README.md for the security rationale.
"""

from __future__ import annotations

from typing import Any

from aiohttp import ClientSession


class KanbanApiError(Exception):
    """Raised when the Supabase REST API returns an error."""


class KanbanAuthError(KanbanApiError):
    """Raised when sign-in fails (bad email/password)."""


class KanbanApiClient:
    """Talks to a Supabase project's PostgREST endpoint for one board."""

    def __init__(
        self,
        session: ClientSession,
        supabase_url: str,
        api_key: str,
        email: str | None = None,
        password: str | None = None,
    ) -> None:
        self._session = session
        root = supabase_url.rstrip("/")
        self._base_url = root + "/rest/v1"
        self._auth_url = root + "/auth/v1/token"
        self._api_key = api_key
        self._email = email
        self._password = password
        self._access_token: str | None = None
        self._refresh_token: str | None = None

    async def async_sign_in(self) -> None:
        """Sign in with email/password (no-op when not configured)."""
        if not self._email:
            return
        await self._token("password", {"email": self._email, "password": self._password})

    async def _token(self, grant_type: str, body: dict[str, Any]) -> None:
        async with self._session.post(
            self._auth_url,
            params={"grant_type": grant_type},
            headers={"apikey": self._api_key, "Content-Type": "application/json"},
            json=body,
        ) as resp:
            if resp.status >= 400:
                text = await resp.text()
                if resp.status in (400, 401, 422):
                    raise KanbanAuthError(f"sign-in failed ({resp.status}): {text}")
                raise KanbanApiError(f"sign-in failed ({resp.status}): {text}")
            data = await resp.json()
        self._access_token = data["access_token"]
        self._refresh_token = data.get("refresh_token")

    async def _reauth(self) -> None:
        if self._refresh_token:
            try:
                await self._token("refresh_token", {"refresh_token": self._refresh_token})
                return
            except KanbanApiError:
                pass
        await self.async_sign_in()

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
        if self._email and not self._access_token:
            await self.async_sign_in()
        for attempt in (1, 2):
            token = self._access_token or self._api_key
            headers = {
                "apikey": self._api_key,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                **(extra_headers or {}),
            }
            async with self._session.request(
                method, self._base_url + path, headers=headers, params=params, json=json
            ) as resp:
                if resp.status == 401 and self._email and attempt == 1:
                    pass  # token expired: re-auth and retry once
                elif resp.status >= 400:
                    text = await resp.text()
                    raise KanbanApiError(f"{method} {path} failed ({resp.status}): {text}")
                else:
                    if resp.content_length == 0 or resp.status == 204:
                        return []
                    return await resp.json()
            await self._reauth()
        return []
