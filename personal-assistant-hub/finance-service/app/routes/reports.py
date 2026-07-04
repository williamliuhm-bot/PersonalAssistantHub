from fastapi import APIRouter, Depends
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
from collections import defaultdict
from app.database import get_db
from app.models import Transaction, TransactionType, Account, Category
from app.currency_utils import to_rub
from app.sql_utils import year_month_expr
from app.schemas import (
    MonthlySummaryResponse,
    CategoryBreakdownItem,
    MonthlyTrendItem,
    BalanceHistoryItem,
    BalanceHistorySeries,
    DashboardResponse,
    CurrencyAmount,
    CurrencyMonthlyStats,
)
from app.cache import cache_get, cache_set
from app.auth import get_current_user_id

router = APIRouter(tags=["reports"])


@router.get("/reports/monthly-summary", response_model=list[MonthlySummaryResponse])
async def monthly_summary(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    months: int = 6,
):
    cache_key = f"report:monthly_summary:{user_id}:{months}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    today = date.today()
    start = today.replace(day=1)
    for _ in range(months - 1):
        start = (start.replace(day=1) - timedelta(days=1)).replace(day=1)

    month_expr = year_month_expr(Transaction.date)

    result = await db.execute(
        select(
            month_expr.label("month"),
            sa_func.coalesce(
                sa_func.sum(Transaction.amount).filter(Transaction.transaction_type == TransactionType.INCOME), 0
            ).label("income"),
            sa_func.coalesce(
                sa_func.sum(Transaction.amount).filter(Transaction.transaction_type == TransactionType.EXPENSE), 0
            ).label("expenses"),
        )
        .where(Transaction.user_id == user_id, Transaction.date >= start)
        .group_by(month_expr)
        .order_by(month_expr)
    )
    rows = result.all()
    data = [
        MonthlySummaryResponse(month=r.month, income=r.income, expenses=r.expenses, net=r.income - r.expenses)
        for r in rows
    ]
    await cache_set(cache_key, [d.model_dump() for d in data])
    return data


@router.get("/reports/category-breakdown", response_model=list[CategoryBreakdownItem])
async def category_breakdown(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    year: Optional[int] = None,
    month: Optional[int] = None,
    days: Optional[int] = None,
):
    today = date.today()

    if year is not None and month is not None:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        cache_key = f"report:category_breakdown:v5:{user_id}:{year}:{month}"
    elif days is not None:
        window_days = max(days, 1)
        end_date = today
        start_date = today - timedelta(days=window_days - 1)
        cache_key = f"report:category_breakdown:v5:{user_id}:days:{window_days}"
    else:
        start_date = today.replace(day=1)
        end_date = today
        cache_key = f"report:category_breakdown:v5:{user_id}:{today.year}:{today.month}"

    cached = await cache_get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(
            Category.name,
            Transaction.amount,
            Account.currency,
        )
        .join(Account, Account.id == Transaction.account_id)
        .outerjoin(
            Category,
            (Category.id == Transaction.category_id) & (Category.user_id == user_id),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == TransactionType.EXPENSE,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
        )
    )

    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for category_name, amount, currency in result.all():
        label = category_name or "Без категории"
        totals[label] += to_rub(amount, currency)

    total = sum(totals.values()) or Decimal("1")
    data = [
        CategoryBreakdownItem(
            category=name,
            amount=amt,
            percentage=float(amt) / float(total) * 100,
        )
        for name, amt in sorted(totals.items(), key=lambda x: x[1], reverse=True)
    ]
    await cache_set(cache_key, [d.model_dump() for d in data])
    return data


@router.get("/reports/monthly-trends", response_model=list[MonthlyTrendItem])
async def monthly_trends(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    months: int = 12,
):
    cache_key = f"report:monthly_trends:v2:{user_id}:{months}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    today = date.today()
    start = today.replace(day=1)
    for _ in range(months - 1):
        start = (start.replace(day=1) - timedelta(days=1)).replace(day=1)

    month_expr = year_month_expr(Transaction.date)

    result = await db.execute(
        select(
            month_expr.label("month"),
            Transaction.transaction_type,
            Transaction.amount,
            Account.currency,
        )
        .join(Account, Account.id == Transaction.account_id)
        .where(Transaction.user_id == user_id, Transaction.date >= start)
    )

    by_month: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"income": Decimal("0"), "expenses": Decimal("0")}
    )
    for month, txn_type, amount, currency in result.all():
        rub_amount = to_rub(amount, currency)
        if txn_type == TransactionType.INCOME:
            by_month[month]["income"] += rub_amount
        elif txn_type == TransactionType.EXPENSE:
            by_month[month]["expenses"] += rub_amount

    data = [
        MonthlyTrendItem(month=month, income=values["income"], expenses=values["expenses"])
        for month, values in sorted(by_month.items())
    ]
    await cache_set(cache_key, [d.model_dump() for d in data])
    return data


@router.get("/reports/balance-history", response_model=list[BalanceHistorySeries])
async def balance_history(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    days: int = 30,
):
    cache_key = f"report:balance_history:v2:{user_id}:{days}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    today = date.today()
    start = today - timedelta(days=days)

    result = await db.execute(select(Account).where(Account.user_id == user_id))
    accounts = result.scalars().all()
    if not accounts:
        return []

    accounts_by_currency: dict[str, list[Account]] = {}
    for account in accounts:
        currency = account.currency or "RUB"
        accounts_by_currency.setdefault(currency, []).append(account)

    series_list: list[BalanceHistorySeries] = []

    for currency, currency_accounts in sorted(accounts_by_currency.items()):
        account_ids = [a.id for a in currency_accounts]
        current_balance = sum(a.balance for a in currency_accounts)

        txn_result = await db.execute(
            select(
                Transaction.date,
                sa_func.coalesce(
                    sa_func.sum(Transaction.amount).filter(
                        Transaction.transaction_type == TransactionType.INCOME
                    ),
                    0,
                ).label("income"),
                sa_func.coalesce(
                    sa_func.sum(Transaction.amount).filter(
                        Transaction.transaction_type == TransactionType.EXPENSE
                    ),
                    0,
                ).label("expense"),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.account_id.in_(account_ids),
                Transaction.date >= start,
            )
            .group_by(Transaction.date)
            .order_by(Transaction.date)
        )
        txn_rows = txn_result.all()

        daily_net: dict[str, Decimal] = {}
        for row in txn_rows:
            daily_net[str(row.date)] = (row.income or Decimal("0")) - (row.expense or Decimal("0"))

        cursor = today
        points: list[BalanceHistoryItem] = []
        balance = current_balance
        while cursor >= start:
            points.append(BalanceHistoryItem(date=str(cursor), balance=balance))
            net = daily_net.get(str(cursor), Decimal("0"))
            balance -= net
            cursor -= timedelta(days=1)

        points.reverse()
        series_list.append(BalanceHistorySeries(currency=currency, points=points))

    await cache_set(cache_key, [s.model_dump() for s in series_list])
    return series_list


@router.get("/reports/dashboard", response_model=DashboardResponse)
async def dashboard(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"report:dashboard:v2:{user_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    today = date.today()
    month_start = today.replace(day=1)

    result = await db.execute(select(Account).where(Account.user_id == user_id))
    accounts = result.scalars().all()
    total_balance = sum(a.balance for a in accounts) if accounts else Decimal("0")

    balance_map: dict[str, Decimal] = {}
    for account in accounts:
        currency = account.currency or "RUB"
        balance_map[currency] = balance_map.get(currency, Decimal("0")) + account.balance
    balances_by_currency = [
        CurrencyAmount(currency=c, amount=amt) for c, amt in sorted(balance_map.items())
    ]

    txn_result = await db.execute(
        select(Transaction, Account.currency)
        .join(Account, Account.id == Transaction.account_id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= month_start,
            Transaction.transaction_type.in_(
                [TransactionType.INCOME, TransactionType.EXPENSE]
            ),
        )
    )
    monthly_map: dict[str, dict[str, Decimal]] = {}
    for txn, currency in txn_result.all():
        cur = currency or "RUB"
        if cur not in monthly_map:
            monthly_map[cur] = {"income": Decimal("0"), "expenses": Decimal("0")}
        if txn.transaction_type == TransactionType.INCOME:
            monthly_map[cur]["income"] += txn.amount
        else:
            monthly_map[cur]["expenses"] += txn.amount

    monthly_by_currency = [
        CurrencyMonthlyStats(
            currency=c,
            income=stats["income"],
            expenses=stats["expenses"],
            net=stats["income"] - stats["expenses"],
        )
        for c, stats in sorted(monthly_map.items())
    ]

    primary_currency = (
        sorted(monthly_map.keys())[0]
        if monthly_map
        else (balances_by_currency[0].currency if balances_by_currency else "RUB")
    )
    primary_stats = monthly_map.get(
        primary_currency, {"income": Decimal("0"), "expenses": Decimal("0")}
    )
    monthly_income = primary_stats["income"]
    monthly_expenses = primary_stats["expenses"]

    if not monthly_map:
        income_result = await db.execute(
            select(sa_func.coalesce(sa_func.sum(Transaction.amount), 0))
            .where(
                Transaction.user_id == user_id,
                Transaction.transaction_type == TransactionType.INCOME,
                Transaction.date >= month_start,
            )
        )
        monthly_income = income_result.scalar()

        expense_result = await db.execute(
            select(sa_func.coalesce(sa_func.sum(Transaction.amount), 0))
            .where(
                Transaction.user_id == user_id,
                Transaction.transaction_type == TransactionType.EXPENSE,
                Transaction.date >= month_start,
            )
        )
        monthly_expenses = expense_result.scalar()

    data = DashboardResponse(
        total_balance=total_balance,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        monthly_net=monthly_income - monthly_expenses,
        balances_by_currency=balances_by_currency,
        monthly_by_currency=monthly_by_currency,
    )
    await cache_set(cache_key, data.model_dump())
    return data
