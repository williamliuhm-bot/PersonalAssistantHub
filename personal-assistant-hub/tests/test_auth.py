import sys
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import select

# Remove any existing 'app' from modules and path, add only auth-service
for mod in list(sys.modules.keys()):
    if mod.startswith("app"):
        del sys.modules[mod]
SERVICE_DIR = str(Path(__file__).resolve().parent.parent / "auth-service")
sys.path = [p for p in sys.path if "auth-service" not in p and "finance-service" not in p and "tasks-service" not in p]
sys.path.insert(0, SERVICE_DIR)

pytestmark = pytest.mark.asyncio

from app.database import Base, get_db
from app.main import app, get_redis
from app.models import User

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


class MockRedis:
    _data = {}
    async def get(self, key): return self._data.get(key)
    async def setex(self, key, ttl, value): self._data[key] = value
    async def set(self, key, value): self._data[key] = value
    async def delete(self, *args):
        for k in args: self._data.pop(k, None)
    async def ping(self): return True
    async def aclose(self): pass
    @classmethod
    def from_url(cls, url, **kwargs): return cls()


mock_redis = MockRedis()
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_redis] = lambda: mock_redis


async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def teardown_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    mock_redis._data.clear()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator:
    await setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    await teardown_db()


async def test_register_user(client: AsyncClient):
    response = await client.post("/auth/register", json={
        "email": "newuser@example.com",
        "username": "newuser",
        "password": "securepass123",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_register_duplicate_email(client: AsyncClient):
    await client.post("/auth/register", json={"email": "dup@example.com", "username": "user1", "password": "securepass123"})
    response = await client.post("/auth/register", json={"email": "dup@example.com", "username": "user2", "password": "securepass456"})
    assert response.status_code == 409


async def test_login_correct_credentials(client: AsyncClient):
    await client.post("/auth/register", json={"email": "login@example.com", "username": "loginuser", "password": "securepass123"})
    response = await client.post("/auth/login", json={"email": "login@example.com", "password": "securepass123"})
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/auth/register", json={"email": "wrong@example.com", "username": "wronguser", "password": "correct"})
    response = await client.post("/auth/login", json={"email": "wrong@example.com", "password": "wrong"})
    assert response.status_code == 401


async def test_token_refresh(client: AsyncClient):
    reg = await client.post("/auth/register", json={"email": "refresh@example.com", "username": "refreshuser", "password": "pass123"})
    refresh = reg.json()["refresh_token"]
    response = await client.post("/auth/refresh", json={"refresh_token": refresh})
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_protected_endpoint_valid_token(client: AsyncClient):
    reg = await client.post("/auth/register", json={"email": "me@example.com", "username": "meuser", "password": "pass123"})
    token = reg.json()["access_token"]
    response = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"


async def test_protected_endpoint_invalid_token(client: AsyncClient):
    response = await client.get("/auth/me", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401


async def promote_to_admin(email: str) -> None:
    async with TestSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one()
        user.role = "admin"
        await session.commit()


async def test_list_users_requires_admin(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "user1@example.com", "username": "user1", "password": "pass123",
    })
    await client.post("/auth/register", json={
        "email": "admin@example.com", "username": "adminuser", "password": "pass123",
    })
    await promote_to_admin("admin@example.com")

    user_login = await client.post("/auth/login", json={
        "email": "user1@example.com", "password": "pass123",
    })
    user_token = user_login.json()["access_token"]
    forbidden = await client.get("/auth/users", headers={"Authorization": f"Bearer {user_token}"})
    assert forbidden.status_code == 403

    admin_login = await client.post("/auth/login", json={
        "email": "admin@example.com", "password": "pass123",
    })
    admin_token = admin_login.json()["access_token"]
    response = await client.get("/auth/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert all("subscription_status" in item for item in data["items"])


async def test_admin_update_user_status(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "target@example.com", "username": "targetuser", "password": "pass123",
    })
    await client.post("/auth/register", json={
        "email": "admin2@example.com", "username": "admin2", "password": "pass123",
    })
    await promote_to_admin("admin2@example.com")

    admin_login = await client.post("/auth/login", json={
        "email": "admin2@example.com", "password": "pass123",
    })
    admin_token = admin_login.json()["access_token"]

    users = await client.get("/auth/users", headers={"Authorization": f"Bearer {admin_token}"})
    target = next(u for u in users.json()["items"] if u["email"] == "target@example.com")

    updated = await client.patch(
        f"/auth/users/{target['id']}",
        json={"subscription_status": "trial", "is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["subscription_status"] == "trial"
    assert body["is_active"] is False
