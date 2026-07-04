"""API tests for Finance page UI button actions."""
from datetime import date

import pytest

from ui_action_registry import FINANCE_ACTIONS, UiAction

pytest_plugins = ["test_finance"]

pytestmark = pytest.mark.asyncio


async def _resolve_path(action: UiAction, ids: dict) -> str:
    mapping = {
        "account_id": ids.get("account_id"),
        "category_id": ids.get("category_id"),
        "transaction_id": ids.get("transaction_id"),
        "budget_id": ids.get("budget_id"),
    }
    path = action.path
    if action.setup and "{id}" in path:
        path = path.replace("{id}", str(mapping[action.setup]))
    return path


async def _request(client, action: UiAction, ids: dict):
    path = await _resolve_path(action, ids)
    params = action.path_params

    if action.method == "GET":
        return await client.get(path, params=params)

    if action.method == "POST":
        body = dict(action.body or {})
        if "transactions" in path and "account_id" not in body:
            body = {
                "account_id": ids["account_id"],
                "amount": 10,
                "transaction_type": "expense",
                "date": str(date.today()),
                "description": "ui",
            }
        if "budgets" in path:
            extra_cat = await client.post("/api/categories", json={"name": f"Budget {date.today()}", "type": "expense", "color": "#333"})
            body["category_id"] = extra_cat.json()["id"]
            body.setdefault("limit_amount", 1000)
            body.setdefault("period", "monthly")
        return await client.post(path, json=body)

    if action.method == "PUT":
        if "categories" in path:
            return await client.put(path, json={"name": "Updated", "type": "expense", "color": "#111"})
        if "accounts" in path:
            return await client.put(path, json={"name": "Updated", "type": "cash", "currency": "RUB"})
        if "transactions" in path:
            return await client.put(path, json={
                "account_id": ids["account_id"], "amount": 99, "transaction_type": "expense",
                "date": str(date.today()), "description": "upd",
            })
        return await client.put(path, json=action.body or {})

    if action.method == "DELETE":
        if action.setup == "category_id":
            extra = await client.post("/api/categories", json={"name": "Del", "type": "expense"})
            path = path.replace(str(ids["category_id"]), str(extra.json()["id"]))
        elif action.setup == "account_id":
            extra = await client.post("/api/accounts", json={"name": "Del", "type": "cash", "balance": 0})
            path = path.replace(str(ids["account_id"]), str(extra.json()["id"]))
        elif action.setup == "transaction_id":
            extra = await client.post("/api/transactions", json={
                "account_id": ids["account_id"], "amount": 1, "transaction_type": "expense",
                "date": str(date.today()), "description": "del",
            })
            path = path.replace(str(ids["transaction_id"]), str(extra.json()["id"]))
        elif action.setup == "budget_id":
            extra_cat = await client.post("/api/categories", json={"name": f"DelBudget {date.today()}", "type": "expense", "color": "#444"})
            extra = await client.post("/api/budgets", json={
                "category_id": extra_cat.json()["id"], "limit_amount": 50, "period": "monthly",
            })
            path = path.replace(str(ids["budget_id"]), str(extra.json()["id"]))
        return await client.delete(path)

    pytest.fail(f"Unknown method {action.method}")


@pytest.fixture
async def finance_ids(client):
    acct = await client.post("/api/accounts", json={"name": "UI", "type": "cash", "balance": 1000})
    cat = await client.post("/api/categories", json={"name": "UI", "type": "expense", "color": "#000"})
    tx = await client.post("/api/transactions", json={
        "account_id": acct.json()["id"], "category_id": cat.json()["id"], "amount": 5,
        "transaction_type": "expense", "date": str(date.today()), "description": "x",
    })
    budget = await client.post("/api/budgets", json={
        "category_id": cat.json()["id"], "limit_amount": 100, "period": "monthly",
    })
    return {
        "account_id": acct.json()["id"],
        "category_id": cat.json()["id"],
        "transaction_id": tx.json()["id"],
        "budget_id": budget.json()["id"],
    }


@pytest.mark.parametrize("action", FINANCE_ACTIONS, ids=lambda a: a.button)
async def test_finance_ui_button_api(client, finance_ids, action: UiAction):
    resp = await _request(client, action, finance_ids)
    assert resp.status_code in (200, 201, 204), f"{action.button}: {resp.status_code} {resp.text}"
