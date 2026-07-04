from datetime import date as Date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class AccountCreate(BaseModel):
    name: str = Field(..., max_length=255)
    type: str = "Bank"
    balance: Decimal = Decimal("0.00")
    currency: str = "USD"


class AccountResponse(BaseModel):
    id: int
    name: str
    type: str
    balance: Decimal
    currency: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    type: str
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    type: str
    icon: Optional[str] = None
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    account_id: int
    category_id: Optional[int] = None
    amount: Decimal
    description: Optional[str] = None
    transaction_type: str
    date: Optional[Date] = None
    is_recurring: bool = False
    recurring_day: Optional[int] = None


class TransactionResponse(BaseModel):
    id: int
    account_id: int
    category_id: Optional[int] = None
    amount: Decimal
    description: Optional[str] = None
    transaction_type: str
    date: Date
    is_recurring: bool
    recurring_day: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BudgetCreate(BaseModel):
    category_id: int
    limit_amount: Decimal
    period: str = "monthly"


class BudgetResponse(BaseModel):
    id: int
    category_id: int
    limit_amount: Decimal
    spent_amount: Decimal
    period: str
    progress_pct: float = 0.0

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"
    status: str = "TODO"
    deadline: Optional[Date] = None
    project_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[Date] = None
    project_id: Optional[int] = None
    order_index: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    deadline: Optional[Date] = None
    project_id: Optional[int] = None
    order_index: int
    created_at: datetime

    model_config = {"from_attributes": True}


class HabitCreate(BaseModel):
    title: str
    description: Optional[str] = None
    frequency: str = "daily"
    color: Optional[str] = "#10B981"


class HabitResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    frequency: str
    streak: int
    last_completed: Optional[Date] = None
    color: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HabitLogCreate(BaseModel):
    habit_id: int
    completed_date: Date


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    is_read: bool
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventMessage(BaseModel):
    event_type: str
    user_id: int
    payload: dict


class ProductivityReportResponse(BaseModel):
    id: int
    report_date: date
    tasks_completed: int
    total_expenses: Decimal
    entertainment_expenses: Decimal
    correlation_score: Optional[float] = None
    insight: Optional[str] = None

    model_config = {"from_attributes": True}


class BudgetForecastResponse(BaseModel):
    id: int
    forecast_date: date
    predicted_expenses: Decimal
    budget_limit: Decimal
    risk_level: str
    recommendation: Optional[str] = None

    model_config = {"from_attributes": True}


class DashboardData(BaseModel):
    total_balance: Decimal
    monthly_income: Decimal
    monthly_expenses: Decimal
    budget_remaining: Decimal
    tasks_completed: int
    active_tasks: int
    habit_streak: int
    insights: list[str] = []
