import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db, async_session_factory, engine, Base
from app.models import Notification
from app.schemas import (
    NotificationResponse,
    NotificationSendRequest,
    SendNotificationResponse,
    MarkReadResponse,
)
from app.tasks import send_email_notification, send_telegram_notification, send_push_notification
from app.routes_telegram import router as telegram_router
from app.telegram_webapp import router as webapp_router
from app import telegram_runtime as runtime

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "").rstrip("/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await runtime.register_webhook()
    await runtime.setup_webapp_menu()

    stop_event = asyncio.Event()
    poll_task = None
    if runtime.should_use_polling():
        poll_task = asyncio.create_task(runtime.polling_loop(stop_event))

    yield

    stop_event.set()
    if poll_task is not None:
        poll_task.cancel()
        try:
            await poll_task
        except asyncio.CancelledError:
            pass
    await engine.dispose()


app = FastAPI(title="Notification Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telegram_router, prefix="/api")
app.include_router(webapp_router, prefix="/api")


@app.get("/health")
async def health():
    db_ok = False
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "ok" if db_ok else "down",
    }


@app.get("/api/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    return result.scalars().all()


@app.patch("/api/notifications/{notification_id}/read", response_model=MarkReadResponse)
async def mark_notification_read(
    notification_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    notification.is_read = True
    await db.commit()
    return MarkReadResponse(id=notification.id, is_read=notification.is_read)


@app.post("/api/notifications/mark-all-read")
async def mark_all_notifications_read(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}


@app.delete("/api/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    await db.delete(notification)
    await db.commit()


@app.post("/api/notifications/send", response_model=SendNotificationResponse, status_code=status.HTTP_201_CREATED)
async def send_notification(
    payload: NotificationSendRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    notification = Notification(
        user_id=user_id,
        type=payload.type,
        title=payload.title,
        message=payload.message,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)

    if payload.type == "email":
        send_email_notification.delay(user_id, payload.title, payload.message)
    elif payload.type == "telegram":
        send_telegram_notification.delay(user_id, payload.title, payload.message)
    elif payload.type == "push":
        send_push_notification.delay(user_id, payload.title, payload.message)

    return SendNotificationResponse(id=notification.id, status="dispatched")
