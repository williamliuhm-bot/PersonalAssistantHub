import sys
from pathlib import Path
from typing import AsyncGenerator
from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Isolate imports - remove any existing 'app' module, add only tasks-service
for mod in list(sys.modules.keys()):
    if mod.startswith("app"):
        del sys.modules[mod]
SERVICE_DIR = str(Path(__file__).resolve().parent.parent / "tasks-service")
sys.path = [p for p in sys.path if "auth-service" not in p and "finance-service" not in p and "tasks-service" not in p]
sys.path.insert(0, SERVICE_DIR)

pytestmark = pytest.mark.asyncio

from app.database import get_db
from app.models import Base
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


async def test_create_project(client: AsyncClient):
    response = await client.post("/api/projects", json={
        "name": "Test Project", "description": "A project for testing",
    })
    assert response.status_code in (200, 201)
    assert response.json()["name"] == "Test Project"


async def test_create_task_in_project(client: AsyncClient):
    proj = await client.post("/api/projects", json={"name": "Work"})
    proj_id = proj.json()["id"]
    response = await client.post("/api/tasks", json={
        "title": "Complete report", "description": "Finish quarterly report",
        "priority": "HIGH", "project_id": proj_id,
    })
    assert response.status_code in (200, 201)
    assert response.json()["title"] == "Complete report"
    assert response.json()["priority"] == "high"
    assert response.json()["status"] == "todo"


async def test_kanban_status_update(client: AsyncClient):
    task = await client.post("/api/tasks", json={"title": "Drag me"})
    task_id = task.json()["id"]
    response = await client.patch(f"/api/tasks/{task_id}", json={"status": "IN_PROGRESS"})
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


async def test_habit_creation(client: AsyncClient):
    response = await client.post("/api/habits", json={
        "title": "Drink Water", "frequency": "daily", "color": "#10B981",
    })
    assert response.status_code in (200, 201)
    assert response.json()["title"] == "Drink Water"
    assert response.json()["streak"] == 0


async def test_habit_logging(client: AsyncClient):
    habit = await client.post("/api/habits", json={"title": "Exercise", "frequency": "daily"})
    habit_id = habit.json()["id"]
    response = await client.post(f"/api/habits/{habit_id}/log")
    assert response.status_code in (200, 201)
    updated = await client.get(f"/api/habits/{habit_id}")
    assert updated.json()["streak"] >= 0
    assert updated.json()["today_count"] == 1


async def test_habit_multiple_logs_per_day(client: AsyncClient):
    habit = await client.post("/api/habits", json={
        "title": "Water",
        "frequency": "daily",
        "times_per_day": 3,
    })
    habit_id = habit.json()["id"]

    for i in range(3):
        response = await client.post(f"/api/habits/{habit_id}/log")
        assert response.status_code in (200, 201)
        updated = await client.get(f"/api/habits/{habit_id}")
        assert updated.json()["today_count"] == i + 1

    blocked = await client.post(f"/api/habits/{habit_id}/log")
    assert blocked.status_code == 409


async def test_list_tasks_with_filters(client: AsyncClient):
    await client.post("/api/tasks", json={"title": "Task A", "priority": "LOW"})
    await client.post("/api/tasks", json={"title": "Task B", "priority": "HIGH"})
    response = await client.get("/api/tasks?priority=HIGH")
    assert response.status_code == 200
    data = response.json()
    assert all(t["priority"] == "high" for t in data)
