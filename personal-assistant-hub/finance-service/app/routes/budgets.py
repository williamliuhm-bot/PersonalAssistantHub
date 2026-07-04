from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal
from datetime import date, timedelta
from typing import Optional
from app.database import get_db
from app.models import Budget, Transaction, TransactionType, BudgetPeriod, Category, CategoryType, Account
from app.schemas import BudgetCreate, BudgetUpdate, BudgetResponse
from app.auth import get_current_user_id
from app.currency_utils import to_rub

router = APIRouter(tags=["budgets"])


def _add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    month += delta
    while month <= 0:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    return year, month


def _stats_period_range(
    year: Optional[int] = None,
    month: Optional[int] = None,
    months: Optional[int] = None,
) -> tuple[date, date, int] | None:
    today = date.today()
    if year is not None and month is not None:
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)
        end = min(end, today)
        return start, end, 1
    if months is not None:
        count = max(months, 1)
        y, m = _add_months(today.year, today.month, -(count - 1))
        start = date(y, m, 1)
        return start, today, count
    return None


def _effective_limit(budget: Budget, month_count: int) -> Decimal:
    if month_count <= 1:
        return budget.limit_amount
    if budget.period == BudgetPeriod.MONTHLY:
        return budget.limit_amount * month_count
    if budget.period == BudgetPeriod.WEEKLY:
        weeks = max(1, round(month_count * 30 / 7))
        return budget.limit_amount * weeks
    if budget.period == BudgetPeriod.YEARLY:
        return budget.limit_amount * Decimal(month_count) / Decimal(12)
    return budget.limit_amount * month_count


def _period_range(budget: Budget) -> tuple[date, date]:
    today = date.today()
    if budget.period == BudgetPeriod.WEEKLY:
        end = today
        start = today - timedelta(days=6)
    elif budget.period == BudgetPeriod.YEARLY:
        start = today.replace(month=1, day=1)
        end = today
    else:
        start = today.replace(day=1)
        end = today
    return start, end


async def compute_spent(
    db: AsyncSession,
    user_id: int,
    budget: Budget,
    start: date | None = None,
    end: date | None = None,
) -> Decimal:
    if start is None or end is None:
        start, end = _period_range(budget)
    result = await db.execute(
        select(Transaction.amount, Account.currency)
        .join(Account, Account.id == Transaction.account_id)
        .where(
            Transaction.user_id == user_id,
            Transaction.category_id == budget.category_id,
            Transaction.transaction_type == TransactionType.EXPENSE,
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    total = Decimal("0")
    for amount, currency in result.all():
        total += to_rub(amount, currency)
    return total


def to_response(
    budget: Budget,
    category: Category | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
    effective_limit: Decimal | None = None,
) -> BudgetResponse:
    limit = effective_limit if effective_limit is not None else budget.limit_amount
    progress = (
        float(budget.spent_amount) / float(limit) * 100
        if limit
        else 0
    )
    return BudgetResponse(
        id=budget.id,
        user_id=budget.user_id,
        category_id=budget.category_id,
        category_name=category.name if category else None,
        category_color=category.color if category else None,
        limit_amount=limit,
        spent_amount=budget.spent_amount,
        period=budget.period,
        period_start=period_start,
        period_end=period_end,
        progress=round(progress, 2),
        created_at=budget.created_at,
        updated_at=budget.updated_at,
    )


async def _load_categories(
    db: AsyncSession, user_id: int, category_ids: set[int]
) -> dict[int, Category]:
    if not category_ids:
        return {}
    result = await db.execute(
        select(Category).where(Category.user_id == user_id, Category.id.in_(category_ids))
    )
    return {c.id: c for c in result.scalars().all()}


def _dedupe_budgets(budgets: list[Budget]) -> list[Budget]:
    seen: dict[tuple[int, BudgetPeriod], Budget] = {}
    for budget in sorted(budgets, key=lambda b: b.id, reverse=True):
        key = (budget.category_id, budget.period)
        if key not in seen:
            seen[key] = budget
    return list(seen.values())


@router.get("/budgets", response_model=list[BudgetResponse])
async def list_budgets(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    year: Optional[int] = None,
    month: Optional[int] = None,
    months: Optional[int] = None,
):
    stats_range = _stats_period_range(year, month, months)
    result = await db.execute(
        select(Budget).where(Budget.user_id == user_id).order_by(Budget.id.desc())
    )
    budgets = _dedupe_budgets(result.scalars().all())
    category_ids = {b.category_id for b in budgets}
    categories = await _load_categories(db, user_id, category_ids)

    items: list[BudgetResponse] = []
    for budget in budgets:
        category = categories.get(budget.category_id)
        if category is None or category.type != CategoryType.EXPENSE:
            continue
        month_count = 1
        if stats_range:
            period_start, period_end, month_count = stats_range
            effective_limit = _effective_limit(budget, month_count)
        else:
            period_start, period_end = _period_range(budget)
            effective_limit = budget.limit_amount
        budget.spent_amount = await compute_spent(
            db, user_id, budget, period_start, period_end
        )
        items.append(
            to_response(
                budget, category, period_start, period_end, effective_limit=effective_limit
            )
        )

    items.sort(key=lambda b: (b.category_name or "").lower())
    return items


@router.post("/budgets", response_model=BudgetResponse, status_code=201)
async def create_budget(
    data: BudgetCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    cat_result = await db.execute(
        select(Category).where(Category.id == data.category_id, Category.user_id == user_id)
    )
    category = cat_result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.type != CategoryType.EXPENSE:
        raise HTTPException(
            status_code=400,
            detail="Budget can only be created for expense categories",
        )

    existing = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.category_id == data.category_id,
            Budget.period == data.period,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Budget for this category and period already exists",
        )

    budget = Budget(
        user_id=user_id,
        category_id=data.category_id,
        limit_amount=data.limit_amount,
        period=data.period,
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    budget.spent_amount = await compute_spent(db, user_id, budget)
    ps, pe = _period_range(budget)
    return to_response(budget, category, ps, pe)


@router.get("/budgets/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    category = (
        await db.execute(
            select(Category).where(Category.id == budget.category_id, Category.user_id == user_id)
        )
    ).scalar_one_or_none()

    budget.spent_amount = await compute_spent(db, user_id, budget)
    ps, pe = _period_range(budget)
    return to_response(budget, category, ps, pe)


@router.put("/budgets/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: int,
    data: BudgetUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)

    await db.commit()
    await db.refresh(budget)
    category = (
        await db.execute(
            select(Category).where(Category.id == budget.category_id, Category.user_id == user_id)
        )
    ).scalar_one_or_none()
    budget.spent_amount = await compute_spent(db, user_id, budget)
    ps, pe = _period_range(budget)
    return to_response(budget, category, ps, pe)


@router.delete("/budgets/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    await db.delete(budget)
    await db.commit()
