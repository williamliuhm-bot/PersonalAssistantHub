from decimal import Decimal
from datetime import date as Date, datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from app.models import AccountType, TransactionType, CategoryType, BudgetPeriod


def _parse_category_type(value) -> CategoryType:
    if isinstance(value, CategoryType):
        return value
    if isinstance(value, str):
        normalized = value.strip().upper()
        if normalized == "INCOME":
            return CategoryType.INCOME
        if normalized == "EXPENSE":
            return CategoryType.EXPENSE
    raise ValueError("type must be 'income' or 'expense'")


def _parse_transaction_type(value) -> TransactionType:
    if isinstance(value, TransactionType):
        return value
    if isinstance(value, str):
        return TransactionType[value.strip().upper()]
    raise ValueError("invalid transaction_type")


def _parse_account_type(value) -> AccountType:
    if isinstance(value, AccountType):
        return value
    if isinstance(value, str):
        return AccountType[value.strip().upper()]
    raise ValueError("invalid account type")


def _parse_budget_period(value) -> BudgetPeriod:
    if isinstance(value, BudgetPeriod):
        return value
    if isinstance(value, str):
        return BudgetPeriod[value.strip().upper()]
    raise ValueError("invalid budget period")


class AccountCreate(BaseModel):
    name: str = Field(..., max_length=128)
    type: AccountType = AccountType.CASH
    balance: Decimal = Decimal("0.00")
    currency: str = Field(default="USD", max_length=3)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        return _parse_account_type(v) if v is not None else AccountType.CASH


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    type: Optional[AccountType] = None
    balance: Optional[Decimal] = None
    currency: Optional[str] = Field(None, max_length=3)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if v is None:
            return v
        return _parse_account_type(v)


class AccountResponse(BaseModel):
    id: int
    user_id: int
    name: str
    type: str
    balance: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if isinstance(v, AccountType):
            return v.value.lower()
        if isinstance(v, str):
            return v.strip().lower()
        return v


class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=128)
    type: CategoryType
    icon: Optional[str] = Field(None, max_length=64)
    color: Optional[str] = Field(None, max_length=7)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        return _parse_category_type(v)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    type: Optional[CategoryType] = None
    icon: Optional[str] = Field(None, max_length=64)
    color: Optional[str] = Field(None, max_length=7)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if v is None:
            return v
        return _parse_category_type(v)


class CategoryResponse(BaseModel):
    id: int
    user_id: int
    name: str
    type: str
    icon: Optional[str]
    color: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if isinstance(v, CategoryType):
            return v.value.lower()
        if isinstance(v, str):
            return v.strip().lower()
        return v


class TransactionCreate(BaseModel):
    account_id: int
    category_id: Optional[int] = None
    amount: Decimal
    description: Optional[str] = Field(None, max_length=256)
    transaction_type: TransactionType
    date: Date
    is_recurring: bool = False
    recurring_day: Optional[int] = Field(None, ge=1, le=31)

    @field_validator("transaction_type", mode="before")
    @classmethod
    def normalize_transaction_type(cls, v):
        return _parse_transaction_type(v)


class TransactionUpdate(BaseModel):
    account_id: Optional[int] = None
    category_id: Optional[int] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = Field(None, max_length=256)
    transaction_type: Optional[TransactionType] = None
    date: Optional[Date] = None
    is_recurring: Optional[bool] = None
    recurring_day: Optional[int] = Field(None, ge=1, le=31)

    @field_validator("transaction_type", mode="before")
    @classmethod
    def normalize_transaction_type(cls, v):
        if v is None:
            return v
        return _parse_transaction_type(v)


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    account_id: int
    category_id: Optional[int]
    amount: Decimal
    description: Optional[str]
    transaction_type: str
    date: Date
    is_recurring: bool
    recurring_day: Optional[int]
    created_at: datetime
    updated_at: datetime
    account_name: Optional[str] = None
    account_currency: Optional[str] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_validator("transaction_type", mode="before")
    @classmethod
    def normalize_transaction_type(cls, v):
        if isinstance(v, TransactionType):
            return v.value.lower()
        if isinstance(v, str):
            return v.strip().lower()
        return str(v).lower()


class BudgetCreate(BaseModel):
    category_id: int
    limit_amount: Decimal
    period: BudgetPeriod = BudgetPeriod.MONTHLY

    @field_validator("period", mode="before")
    @classmethod
    def normalize_period(cls, v):
        return _parse_budget_period(v) if v is not None else BudgetPeriod.MONTHLY


class BudgetUpdate(BaseModel):
    limit_amount: Optional[Decimal] = None
    period: Optional[BudgetPeriod] = None

    @field_validator("period", mode="before")
    @classmethod
    def normalize_period(cls, v):
        if v is None:
            return v
        return _parse_budget_period(v)


class BudgetResponse(BaseModel):
    id: int
    user_id: int
    category_id: int
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    limit_amount: Decimal
    spent_amount: Decimal
    period: str
    period_start: Optional[Date] = None
    period_end: Optional[Date] = None
    progress: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("period", mode="before")
    @classmethod
    def normalize_period(cls, v):
        if isinstance(v, BudgetPeriod):
            return v.value.lower()
        if isinstance(v, str):
            return v.strip().lower()
        return str(v).lower()


class MonthlySummaryResponse(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    net: Decimal


class CategoryBreakdownItem(BaseModel):
    category: str
    amount: Decimal
    percentage: float


class MonthlyTrendItem(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal


class BalanceHistoryItem(BaseModel):
    date: str
    balance: Decimal


class BalanceHistorySeries(BaseModel):
    currency: str
    points: list[BalanceHistoryItem]


class CurrencyAmount(BaseModel):
    currency: str
    amount: Decimal


class CurrencyMonthlyStats(BaseModel):
    currency: str
    income: Decimal
    expenses: Decimal
    net: Decimal


class DashboardResponse(BaseModel):
    total_balance: Decimal
    monthly_income: Decimal
    monthly_expenses: Decimal
    monthly_net: Decimal
    balances_by_currency: list[CurrencyAmount] = []
    monthly_by_currency: list[CurrencyMonthlyStats] = []
