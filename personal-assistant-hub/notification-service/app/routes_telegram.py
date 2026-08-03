import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.schemas import (
    TelegramLinkTokenResponse,
    TelegramSettingsUpdate,
    TelegramStatusResponse,
)
from app import telegram_service as tg
from app import telegram_runtime as runtime

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "").lstrip("@")

router = APIRouter(tags=["telegram"])


def _status_payload(link, linked: bool) -> TelegramStatusResponse:
    return TelegramStatusResponse(
        linked=linked,
        chat_id_masked=tg.mask_chat_id(link.chat_id) if link and linked else None,
        default_account_id=link.default_account_id if link and linked else None,
        bot_username=TELEGRAM_BOT_USERNAME or None,
        bot_url=f"https://t.me/{TELEGRAM_BOT_USERNAME}" if TELEGRAM_BOT_USERNAME else None,
    )


@router.post("/telegram/link-token", response_model=TelegramLinkTokenResponse)
async def create_link_token(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    token_row = await tg.create_link_token(db, user_id)
    return TelegramLinkTokenResponse(
        token=token_row.token,
        deep_link=tg.build_deep_link(token_row.token),
        expires_at=token_row.expires_at,
    )


@router.get("/telegram/status", response_model=TelegramStatusResponse)
async def telegram_status(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    link = await tg.get_link_by_user(db, user_id)
    if link is None:
        return _status_payload(None, False)
    return _status_payload(link, True)


@router.put("/telegram/settings", response_model=TelegramStatusResponse)
async def update_telegram_settings(
    payload: TelegramSettingsUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    link = await tg.get_link_by_user(db, user_id)
    if link is None:
        raise HTTPException(status_code=404, detail="Telegram not linked")
    link.default_account_id = payload.default_account_id
    link.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return _status_payload(link, True)


@router.delete("/telegram/link", status_code=status.HTTP_204_NO_CONTENT)
async def delete_telegram_link(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    ok = await tg.unlink_user(db, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Telegram not linked")


@router.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(
        default=None, alias="X-Telegram-Bot-Api-Secret-Token"
    ),
):
    if TELEGRAM_WEBHOOK_SECRET:
        if x_telegram_bot_api_secret_token != TELEGRAM_WEBHOOK_SECRET:
            raise HTTPException(status_code=403, detail="Invalid webhook secret")
    elif not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram bot not configured")

    body = await request.json()
    message = body.get("message") or body.get("edited_message")
    if not message:
        return {"ok": True}

    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = message.get("text") or ""
    if chat_id is None:
        return {"ok": True}

    reply = await runtime.process_chat_message(db, int(chat_id), text)
    await runtime.send_reply(int(chat_id), reply)
    return {"ok": True}
