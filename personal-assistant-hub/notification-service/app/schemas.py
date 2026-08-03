from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    is_read: bool
    sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationSendRequest(BaseModel):
    type: str = Field(..., pattern="^(email|telegram|push)$")
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)


class SendNotificationResponse(BaseModel):
    id: str
    status: str


class MarkReadResponse(BaseModel):
    id: str
    is_read: bool


class TelegramLinkTokenResponse(BaseModel):
    token: str
    deep_link: str
    expires_at: datetime


class TelegramStatusResponse(BaseModel):
    linked: bool
    chat_id_masked: Optional[str] = None
    default_account_id: Optional[int] = None
    bot_username: Optional[str] = None
    bot_url: Optional[str] = None


class TelegramSettingsUpdate(BaseModel):
    default_account_id: Optional[int] = None
