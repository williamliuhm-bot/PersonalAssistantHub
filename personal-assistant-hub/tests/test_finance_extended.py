"""API tests for finance endpoints used by UI buttons."""
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

for mod in list(sys.modules.keys()):
    if mod.startswith("app"):
        del sys.modules[mod]
SERVICE_DIR = str(Path(__file__).resolve().parent.parent / "finance-service")
sys.path = [p for p in sys.path if "auth-service" not in p and "finance-service" not in p and "tasks-service" not in p]
sys.path.insert(0, SERVICE_DIR)

pytestmark = pytest.mark.asyncio

from app.auth import get_current_user_id  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user_id] = lambda: 1


async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def teardown_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator:
    await setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    await teardown_db()


@pytest_asyncio.fixture
async def account_id(client: AsyncClient):
    resp = await client.post("/api/accounts", json={"name": "Main", "type": "bank", "balance": 5000, "currency": "RUB"})
    return resp.json()["id"]


@pytest_asyncio.fixture
async def expense_category_id(client: AsyncClient):
    resp = await client.post("/api/categories", json={"name": "Food", "type": "expense", "color": "#2563EB"})
    return resp.json()["id"]


# --- Accounts (Добавить счёт, редактировать) ---

async def test_update_account(client: AsyncClient, account_id: int):
    resp = await client.put(f"/api/accounts/{account_id}", json={"name": "Updated Bank", "type": "bank", "currency": "USD"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Bank"
    assert resp.json()["currency"] == "USD"


async def test_delete_account(client: AsyncClient, account_id: int):
    resp = await client.delete(f"/api/accounts/{account_id}")
    assert resp.status_code == 204
    assert (await client.get(f"/api/accounts/{account_id}")).status_code == 404


# --- Categories (Категории, редактировать, удалить) ---

async def test_update_category(client: AsyncClient, expense_category_id: int):
    resp = await client.put(
        f"/api/categories/{expense_category_id}",
        json={"name": "Groceries", "type": "expense", "color": "#10B981"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Groceries"


async def test_delete_category(client: AsyncClient, expense_category_id: int):
    resp = await client.delete(f"/api/categories/{expense_category_id}")
    assert resp.status_code == 204


async def test_list_categories(client: AsyncClient, expense_category_id: int):
    resp = await client.get("/api/categories")
    assert resp.status_code == 200
    assert any(c["id"] == expense_category_id for c in resp.json())


# --- Transactions (Добавить, фильтр по датам) ---

async def test_create_income_transaction(client: AsyncClient, account_id: int):
    resp = await client.post("/api/transactions", json={
        "account_id": account_id,
        "amount": 500,
        "description": "Salary",
        "transaction_type": "income",
        "date": str(date.today()),
    })
    assert resp.status_code in (200, 201)
    assert resp.json()["transaction_type"] == "income"


async def test_list_transactions_date_filter(client: AsyncClient, account_id: int, expense_category_id: int):
    today = date.today()
    old = today - timedelta(days=10)
    await client.post("/api/transactions", json={
        "account_id": account_id, "category_id": expense_category_id, "amount": 10,
        "transaction_type": "expense", "date": str(old), "description": "old",
    })
    await client.post("/api/transactions", json={
        "account_id": account_id, "category_id": expense_category_id, "amount": 20,
        "transaction_type": "expense", "date": str(today), "description": "today",
    })
    resp = await client.get(f"/api/transactions?date_from={today}&date_to={today}")
    assert resp.status_code == 200
    data = resp.json()
    assert all(t["date"][:10] == str(today) for t in data)


async def test_update_transaction(client: AsyncClient, account_id: int, expense_category_id: int):
    created = await client.post("/api/transactions", json={
        "account_id": account_id, "category_id": expense_category_id, "amount": 15,
        "transaction_type": "expense", "date": str(date.today()), "description": "Lunch",
    })
    tx_id = created.json()["id"]
    resp = await client.put(f"/api/transactions/{tx_id}", json={
        "account_id": account_id, "category_id": expense_category_id, "amount": 25,
        "transaction_type": "expense", "date": str(date.today()), "description": "Dinner",
    })
    assert resp.status_code == 200
    assert float(resp.json()["amount"]) == 25


async def test_delete_transaction(client: AsyncClient, account_id: int):
    created = await client.post("/api/transactions", json={
        "account_id": account_id, "amount": 5, "transaction_type": "expense",
        "date": str(date.today()), "description": "temp",
    })
    tx_id = created.json()["id"]
    resp = await client.delete(f"/api/transactions/{tx_id}")
    assert resp.status_code == 204


# --- Budgets (Добавить, удалить, периоды статистики) ---

async def test_budget_list_with_month_param(client: AsyncClient, account_id: int, expense_category_id: int):
    await client.post("/api/budgets", json={
        "category_id": expense_category_id, "limit_amount": 1000, "period": "monthly",
    })
    today = date.today()
    resp = await client.get(f"/api/budgets?year={today.year}&month={today.month}")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
    assert resp.json()[0]["period_start"] is not None


async def test_budget_three_month_limit_scaled(client: AsyncClient, expense_category_id: int):
    await client.post("/api/budgets", json={
        "category_id": expense_category_id, "limit_amount": 100, "period": "monthly",
    })
    resp = await client.get("/api/budgets?months=3")
    assert resp.status_code == 200
    budget = resp.json()[0]
    assert float(budget["limit_amount"]) == 300.0


async def test_delete_budget(client: AsyncClient, expense_category_id: int):
    created = await client.post("/api/budgets", json={
        "category_id": expense_category_id, "limit_amount": 500, "period": "monthly",
    })
    budget_id = created.json()["id"]
    resp = await client.delete(f"/api/budgets/{budget_id}")
    assert resp.status_code == 204


# --- Reports (графики, отчёты) ---

async def test_category_breakdown_calendar_month(client: AsyncClient, account_id: int, expense_category_id: int):
    await client.post("/api/transactions", json={
        "account_id": account_id, "category_id": expense_category_id, "amount": 100,
        "transaction_type": "expense", "date": str(date.today()), "description": "test",
    })
    today = date.today()
    resp = await client.get(f"/api/reports/category-breakdown?year={today.year}&month={today.month}")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_monthly_trends(client: AsyncClient):
    resp = await client.get("/api/reports/monthly-trends?months=3")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_balance_history(client: AsyncClient, account_id: int):
    resp = await client.get("/api/reports/balance-history?days=30")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_dashboard_report(client: AsyncClient):
    resp = await client.get("/api/reports/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_balance" in data
