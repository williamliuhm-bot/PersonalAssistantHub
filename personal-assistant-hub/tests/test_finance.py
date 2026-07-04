import sys
from pathlib import Path
from typing import AsyncGenerator
from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Isolate imports - remove any existing 'app' module, add only finance-service
for mod in list(sys.modules.keys()):
    if mod.startswith("app"):
        del sys.modules[mod]
SERVICE_DIR = str(Path(__file__).resolve().parent.parent / "finance-service")
sys.path = [p for p in sys.path if "auth-service" not in p and "finance-service" not in p and "tasks-service" not in p]
sys.path.insert(0, SERVICE_DIR)

pytestmark = pytest.mark.asyncio

from app.database import Base, get_db
from app.main import app
from app.auth import get_current_user_id

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


async def test_create_account(client: AsyncClient):
    response = await client.post("/api/accounts", json={
        "name": "Test Bank", "type": "bank", "balance": 1000.00, "currency": "USD",
    })
    assert response.status_code in (200, 201)
    assert response.json()["name"] == "Test Bank"
    assert float(response.json()["balance"]) == 1000.00


async def test_list_accounts(client: AsyncClient):
    await client.post("/api/accounts", json={"name": "Cash", "type": "cash", "balance": 500})
    await client.post("/api/accounts", json={"name": "Bank", "type": "bank", "balance": 2000})
    response = await client.get("/api/accounts")
    assert response.status_code == 200
    assert len(response.json()) >= 2


async def test_create_transaction_updates_balance(client: AsyncClient):
    acct = await client.post("/api/accounts", json={"name": "Wallet", "type": "cash", "balance": 1000})
    acct_id = acct.json()["id"]
    cat = await client.post("/api/categories", json={"name": "Food", "type": "expense"})
    cat_id = cat.json()["id"]
    await client.post("/api/transactions", json={
        "account_id": acct_id, "category_id": cat_id, "amount": 50.00,
        "description": "Lunch", "transaction_type": "expense", "date": str(date.today()),
    })
    acct_resp = await client.get(f"/api/accounts/{acct_id}")
    assert float(acct_resp.json()["balance"]) == 950.00


async def test_budget_progress_calculation(client: AsyncClient):
    acct = await client.post("/api/accounts", json={"name": "Wallet", "type": "cash", "balance": 5000})
    cat = await client.post("/api/categories", json={"name": "Food", "type": "expense"})
    budget = await client.post("/api/budgets", json={
        "category_id": cat.json()["id"], "limit_amount": 1000, "period": "monthly",
    })
    budget_id = budget.json()["id"]
    await client.post("/api/transactions", json={
        "account_id": acct.json()["id"], "category_id": cat.json()["id"],
        "amount": 300, "description": "Groceries", "transaction_type": "expense",
        "date": str(date.today()),
    })
    resp = await client.get(f"/api/budgets/{budget_id}")
    assert resp.status_code == 200
    assert float(resp.json()["spent_amount"]) >= 300
    assert resp.json()["progress"] > 0
