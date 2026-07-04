from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from decimal import Decimal
from typing import Optional
import os
import httpx
from app.database import get_db
from app.models import Transaction, Account, TransactionType, Category
from app.schemas import TransactionCreate, TransactionUpdate, TransactionResponse
from app.cache import cache_invalidate
from app.auth import get_current_user_id

router = APIRouter(tags=["transactions"])

INTEGRATION_SERVICE_URL = os.getenv(
    "INTEGRATION_SERVICE_URL", "http://integration-service:8005"
)


async def _invalidate_user_reports(user_id: int) -> None:
    await cache_invalidate(f"report:*{user_id}*")


async def _emit_recurring_payment_event(
    user_id: int,
    description: str,
    recurring_day: int | None,
) -> None:
    payload = {
        "event_type": "recurring_payment_created",
        "user_id": user_id,
        "data": {
            "description": description or "Recurring payment",
            "recurring_day": recurring_day or 1,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{INTEGRATION_SERVICE_URL}/api/events", json=payload)
    except Exception:
        pass


def _enrich_transaction(txn: Transaction, accounts: dict[int, Account], categories: dict[int, Category]) -> dict:
    data = TransactionResponse.model_validate(txn).model_dump()
    account = accounts.get(txn.account_id)
    category = categories.get(txn.category_id) if txn.category_id else None
    data["account_name"] = account.name if account else None
    data["account_currency"] = account.currency if account else None
    data["category_name"] = category.name if category else None
    data["category_color"] = category.color if category else None
    return data


async def _load_accounts(db: AsyncSession, user_id: int, account_ids: set[int]) -> dict[int, Account]:
    if not account_ids:
        return {}
    result = await db.execute(
        select(Account).where(Account.user_id == user_id, Account.id.in_(account_ids))
    )
    return {a.id: a for a in result.scalars().all()}


async def _load_categories(db: AsyncSession, user_id: int, category_ids: set[int]) -> dict[int, Category]:
    if not category_ids:
        return {}
    result = await db.execute(
        select(Category).where(Category.user_id == user_id, Category.id.in_(category_ids))
    )
    return {c.id: c for c in result.scalars().all()}


async def apply_balance_change(
    db: AsyncSession,
    account_id: int,
    user_id: int,
    amount: Decimal,
    txn_type: TransactionType,
    reverse: bool = False,
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if reverse:
        if txn_type == TransactionType.INCOME:
            account.balance -= amount
        elif txn_type == TransactionType.EXPENSE:
            account.balance += amount
    else:
        if txn_type == TransactionType.INCOME:
            account.balance += amount
        elif txn_type == TransactionType.EXPENSE:
            account.balance -= amount

    await db.flush()


@router.get("/transactions", response_model=list[TransactionResponse])
async def list_transactions(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    category_id: Optional[int] = None,
    transaction_type: Optional[TransactionType] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    filters = [Transaction.user_id == user_id]
    if category_id is not None:
        filters.append(Transaction.category_id == category_id)
    if transaction_type is not None:
        filters.append(Transaction.transaction_type == transaction_type)
    if date_from is not None:
        filters.append(Transaction.date >= date_from)
    if date_to is not None:
        filters.append(Transaction.date <= date_to)

    query = (
        select(Transaction)
        .where(and_(*filters))
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )

    result = await db.execute(query)
    txns = result.scalars().all()

    account_ids = {t.account_id for t in txns}
    category_ids = {t.category_id for t in txns if t.category_id}
    accounts = await _load_accounts(db, user_id, account_ids)
    categories = await _load_categories(db, user_id, category_ids)

    return [_enrich_transaction(t, accounts, categories) for t in txns]


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    txn = Transaction(
        user_id=user_id,
        account_id=data.account_id,
        category_id=data.category_id,
        amount=data.amount,
        description=data.description,
        transaction_type=data.transaction_type,
        date=data.date,
        is_recurring=data.is_recurring,
        recurring_day=data.recurring_day,
    )

    await apply_balance_change(db, data.account_id, user_id, data.amount, data.transaction_type)

    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    await _invalidate_user_reports(user_id)
    if data.is_recurring and data.transaction_type == TransactionType.EXPENSE:
        await _emit_recurring_payment_event(
            user_id, data.description or "", data.recurring_day
        )
    accounts = await _load_accounts(db, user_id, {txn.account_id})
    categories = await _load_categories(db, user_id, {txn.category_id} if txn.category_id else set())
    return _enrich_transaction(txn, accounts, categories)


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user_id
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user_id
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    old_account_id = txn.account_id
    old_amount = txn.amount
    old_type = txn.transaction_type

    await apply_balance_change(db, old_account_id, user_id, old_amount, old_type, reverse=True)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(txn, field, value)

    await apply_balance_change(db, txn.account_id, user_id, txn.amount, txn.transaction_type)

    await db.commit()
    await db.refresh(txn)
    await _invalidate_user_reports(user_id)
    accounts = await _load_accounts(db, user_id, {txn.account_id})
    categories = await _load_categories(db, user_id, {txn.category_id} if txn.category_id else set())
    return _enrich_transaction(txn, accounts, categories)


@router.delete("/transactions/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user_id
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await apply_balance_change(db, txn.account_id, user_id, txn.amount, txn.transaction_type, reverse=True)

    await db.delete(txn)
    await db.commit()
    await _invalidate_user_reports(user_id)
