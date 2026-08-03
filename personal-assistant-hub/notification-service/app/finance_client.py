import os
from typing import Any

import httpx

FINANCE_SERVICE_URL = os.getenv("FINANCE_SERVICE_URL", "http://finance-service:8002")
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")


class FinanceClientError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _headers() -> dict[str, str]:
    if not INTERNAL_SERVICE_TOKEN:
        raise FinanceClientError("INTERNAL_SERVICE_TOKEN not configured", 503)
    return {"X-Internal-Token": INTERNAL_SERVICE_TOKEN}


async def list_accounts(user_id: int) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{FINANCE_SERVICE_URL}/api/internal/accounts",
            params={"user_id": user_id},
            headers=_headers(),
        )
    if resp.status_code != 200:
        raise FinanceClientError(resp.text or "Failed to list accounts", resp.status_code)
    return resp.json()


async def list_categories(user_id: int) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{FINANCE_SERVICE_URL}/api/internal/categories",
            params={"user_id": user_id},
            headers=_headers(),
        )
    if resp.status_code != 200:
        raise FinanceClientError(resp.text or "Failed to list categories", resp.status_code)
    return resp.json()


async def create_transaction(payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{FINANCE_SERVICE_URL}/api/internal/transactions",
            json=payload,
            headers=_headers(),
        )
    if resp.status_code not in (200, 201):
        detail = resp.text
        try:
            detail = resp.json().get("detail", detail)
        except Exception:
            pass
        raise FinanceClientError(str(detail), resp.status_code)
    return resp.json()
