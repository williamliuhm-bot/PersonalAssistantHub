import asyncio
import logging
import os
from email.mime.text import MIMEText

import aiosmtplib
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://app:app_secret_2024@localhost:5432/personal_assistant_hub",
)


def _get_engine():
    return create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)


@celery_app.task
def send_email_notification(user_id: str, title: str, message: str):
    async def _execute():
        engine = _get_engine()
        try:
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("SELECT email FROM users WHERE id = :user_id"),
                    {"user_id": user_id},
                )
                row = result.fetchone()
                if row is None:
                    logger.warning("User %s not found for email notification", user_id)
                    return
                recipient = row[0]

            smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER", "")
            smtp_password = os.getenv("SMTP_PASSWORD", "")

            if not smtp_user:
                logger.warning("SMTP not configured. Would send email to %s: %s", recipient, title)
                return

            msg = MIMEText(message, "plain", "utf-8")
            msg["Subject"] = title
            msg["From"] = smtp_user
            msg["To"] = recipient

            await aiosmtplib.send(
                msg,
                hostname=smtp_host,
                port=smtp_port,
                username=smtp_user,
                password=smtp_password,
                use_tls=False,
                start_tls=True,
            )
            logger.info("Email sent to %s: %s", recipient, title)
        finally:
            await engine.dispose()

    asyncio.run(_execute())


@celery_app.task
def send_telegram_notification(user_id: str, title: str, message: str):
    async def _execute():
        token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        chat_id = os.getenv("TELEGRAM_DEFAULT_CHAT_ID", "")
        if not token or not chat_id:
            logger.warning(
                "Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_DEFAULT_CHAT_ID). "
                "Skipping notification for user %s: %s",
                user_id,
                title,
            )
            return

        from telegram import Bot

        bot = Bot(token=token)
        text_msg = f"*{title}*\n\n{message}"
        await bot.send_message(chat_id=chat_id, text=text_msg, parse_mode="Markdown")
        logger.info("Telegram message sent for user %s: %s", user_id, title)

    asyncio.run(_execute())


@celery_app.task
def send_push_notification(user_id: str, title: str, message: str):
    logger.info("Push notification for user %s: %s - %s", user_id, title, message)
