from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

UserRole = Literal["user", "admin"]
SubscriptionStatus = Literal["free", "trial", "active", "past_due", "cancelled", "expired"]


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=255)


class UserLogin(BaseModel):
    email: str = Field(..., description="Email or username")
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    role: UserRole
    is_active: bool
    subscription_status: SubscriptionStatus
    subscription_plan: str | None
    subscription_expires_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None
    subscription_status: SubscriptionStatus | None = None
    subscription_plan: str | None = None
    subscription_expires_at: datetime | None = None


class ErrorResponse(BaseModel):
    detail: str
