"""Telegram inbound: webhook + local long-polling."""
from __future__ import annotations

import asyncio
import logging
import os

from sqlalchemy.ext.asyncio import AsyncSession
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, MenuButtonWebApp, WebAppInfo

from app.database import async_session_factory
from app import telegram_service as tg
from app.telegram_bot import create_bot

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "").rstrip("/")
TELEGRAM_WEBAPP_URL = os.getenv("TELEGRAM_WEBAPP_URL", "").rstrip("/")
TELEGRAM_USE_POLLING = os.getenv("TELEGRAM_USE_POLLING", "").strip().lower() in (
    "1",
    "true",
    "yes",
)


def should_use_polling() -> bool:
    if not TELEGRAM_BOT_TOKEN:
        return False
    if TELEGRAM_USE_POLLING:
        return True
    if not API_PUBLIC_URL:
        return True
    host = API_PUBLIC_URL.replace("https://", "").replace("http://", "")
    return host.startswith("localhost") or host.startswith("127.0.0.1")


def webapp_page_url() -> str | None:
    if not TELEGRAM_WEBAPP_URL:
        return None
    if TELEGRAM_WEBAPP_URL.endswith("/tg"):
        return TELEGRAM_WEBAPP_URL
    return f"{TELEGRAM_WEBAPP_URL}/tg"


async def setup_webapp_menu() -> None:
    url = webapp_page_url()
    if not TELEGRAM_BOT_TOKEN or not url:
        logger.info(
            "Telegram Mini App menu not set (need TELEGRAM_BOT_TOKEN + TELEGRAM_WEBAPP_URL)"
        )
        return
    if url.startswith("http://") and "localhost" not in url and "127.0.0.1" not in url:
        pass  # allow http only for local; Telegram usually requires https
    try:
        bot = create_bot()
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Финансы",
                web_app=WebAppInfo(url=url),
            )
        )
        logger.info("Telegram Mini App menu button set: %s", url)
    except Exception:
        logger.exception("Failed to set Telegram menu button")


async def process_chat_message(db: AsyncSession, chat_id: int, text: str) -> str:
    try:
        return await tg.handle_bot_command(db, int(chat_id), text)
    except Exception:
        logger.exception("Telegram command failed")
        return "Внутренняя ошибка. Попробуйте позже."


async def send_reply(chat_id: int, text: str, reply_markup=None) -> None:
    if not TELEGRAM_BOT_TOKEN:
        return
    try:
        bot = create_bot()
        await bot.send_message(chat_id=chat_id, text=text, reply_markup=reply_markup)
    except Exception:
        logger.exception("Failed to send Telegram reply")


async def send_webapp_open(chat_id: int) -> None:
    url = webapp_page_url()
    if not url:
        await send_reply(
            chat_id,
            "Mini App ещё не настроен. Задайте TELEGRAM_WEBAPP_URL (HTTPS) на сервере.",
        )
        return
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(text="Открыть финансы", web_app=WebAppInfo(url=url))]]
    )
    await send_reply(
        chat_id,
        "Откройте мини-приложение, чтобы видеть счета и добавлять доходы/расходы:",
        reply_markup=keyboard,
    )


def _command_name(text: str) -> str:
    first = (text or "").strip().split(maxsplit=1)[0]
    return first.split("@", 1)[0].lower()


async def handle_update_dict(update: dict) -> None:
    message = update.get("message") or update.get("edited_message")
    if not message:
        return
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = message.get("text") or ""
    if chat_id is None:
        return

    cmd = _command_name(text)
    if cmd in ("/app", "/miniapp", "/webapp"):
        await send_webapp_open(int(chat_id))
        return

    async with async_session_factory() as db:
        reply = await process_chat_message(db, int(chat_id), text)
    await send_reply(int(chat_id), reply)


async def register_webhook() -> None:
    if should_use_polling():
        logger.info("Telegram polling mode — skipping setWebhook")
        return
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_WEBHOOK_SECRET or not API_PUBLIC_URL:
        logger.info(
            "Telegram webhook not registered "
            "(need TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, API_PUBLIC_URL)"
        )
        return
    webhook_url = f"{API_PUBLIC_URL}/notification/api/telegram/webhook"
    try:
        bot = create_bot()
        await bot.set_webhook(
            url=webhook_url,
            secret_token=TELEGRAM_WEBHOOK_SECRET,
            drop_pending_updates=True,
        )
        logger.info("Telegram webhook set to %s", webhook_url)
    except Exception:
        logger.exception("Failed to set Telegram webhook")


async def polling_loop(stop_event: asyncio.Event) -> None:
    bot = create_bot()
    offset: int | None = None
    webhook_cleared = False

    while not stop_event.is_set():
        try:
            if not webhook_cleared:
                await bot.delete_webhook(drop_pending_updates=True)
                webhook_cleared = True
                logger.info("Telegram long-polling started")

            updates = await bot.get_updates(offset=offset, timeout=25)
            for update in updates:
                offset = update.update_id + 1
                await handle_update_dict(update.to_dict())
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Telegram polling error; retry in 5s")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=5)
            except asyncio.TimeoutError:
                pass
