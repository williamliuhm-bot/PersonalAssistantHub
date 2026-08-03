"""Telegram Mini App (WebApp) initData validation and session exchange."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session_factory
from app import telegram_service as tg

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key-2024")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
INIT_DATA_MAX_AGE_SECONDS = int(os.getenv("TELEGRAM_WEBAPP_INIT_MAX_AGE", "86400"))

router = APIRouter(tags=["telegram-webapp"])


class WebAppAuthRequest(BaseModel):
    init_data: str = Field(..., min_length=10)


class WebAppAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    telegram_user: dict | None = None


def validate_webapp_init_data(init_data: str, bot_token: str) -> dict:
    """Validate Telegram WebApp initData per Bot API docs. Returns parsed fields."""
    if not bot_token:
        raise HTTPException(status_code=503, detail="Bot token not configured")

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="Missing initData hash")

    # signature is for newer algorithm; exclude from classic HMAC check string
    pairs.pop("signature", None)

    data_check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret_key, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        raise HTTPException(status_code=401, detail="Invalid initData signature")

    auth_date_raw = pairs.get("auth_date")
    if auth_date_raw:
        try:
            auth_date = int(auth_date_raw)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid auth_date") from exc
        age = datetime.now(timezone.utc).timestamp() - auth_date
        if age > INIT_DATA_MAX_AGE_SECONDS:
            raise HTTPException(status_code=401, detail="initData expired")

    user_raw = pairs.get("user")
    user = None
    if user_raw:
        try:
            user = json.loads(user_raw)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=401, detail="Invalid user payload") from exc

    return {"fields": pairs, "user": user}


def _create_access_token(user_id: str, role: str = "user") -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


async def _lookup_role(user_id: str) -> str:
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                text("SELECT role FROM users WHERE id = :id LIMIT 1"),
                {"id": int(user_id) if user_id.isdigit() else user_id},
            )
            row = result.fetchone()
            if row and row[0]:
                return str(row[0])
    except Exception:
        logger.exception("Failed to lookup user role for webapp auth")
    return "user"


@router.post("/telegram/webapp/auth", response_model=WebAppAuthResponse)
async def webapp_auth(
    payload: WebAppAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    parsed = validate_webapp_init_data(payload.init_data, TELEGRAM_BOT_TOKEN)
    tg_user = parsed.get("user") or {}
    tg_id = tg_user.get("id")
    if tg_id is None:
        raise HTTPException(status_code=401, detail="No Telegram user in initData")

    # Private chat: chat_id == telegram user id
    link = await tg.get_link_by_chat(db, int(tg_id))
    if link is None:
        raise HTTPException(
            status_code=403,
            detail="Telegram не привязан. Откройте бота и выполните привязку в Настройках.",
        )

    role = await _lookup_role(link.user_id)
    token = _create_access_token(link.user_id, role=role)
    return WebAppAuthResponse(
        access_token=token,
        user_id=link.user_id,
        telegram_user={
            "id": tg_id,
            "first_name": tg_user.get("first_name"),
            "username": tg_user.get("username"),
        },
    )
