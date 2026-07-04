import os

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT_ALGORITHM", "HS256")

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import asyncio
from datetime import datetime, timedelta
from typing import AsyncGenerator

import jwt
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport


def make_token(user_id=1) -> str:
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, "test-secret-key", algorithm="HS256")


def auth_headers(user_id=1) -> dict:
    return {"Authorization": f"Bearer {make_token(user_id)}"}


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def anyio_backend():
    return "asyncio"
