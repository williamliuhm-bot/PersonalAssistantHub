from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.internal_auth import require_internal_token
from app.models import Account, Category, Transaction, TransactionType
from app.schemas import (
    AccountResponse,
    CategoryResponse,
    InternalTransactionCreate,
    TransactionResponse,
)
from app.routes.transactions import (
    apply_balance_change,
    _emit_recurring_payment_event,
    _enrich_transaction,
    _invalidate_user_reports,
    _load_accounts,
    _load_categories,
)

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(require_internal_token)],
)


@router.get("/accounts", response_model=list[AccountResponse])
async def internal_list_accounts(
    user_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.user_id == user_id).order_by(Account.id)
    )
    return result.scalars().all()


@router.get("/categories", response_model=list[CategoryResponse])
async def internal_list_categories(
    user_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.user_id == user_id).order_by(Category.id)
    )
    return result.scalars().all()


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
async def internal_create_transaction(
    data: InternalTransactionCreate,
    db: AsyncSession = Depends(get_db),
):
    user_id = data.user_id

    account_result = await db.execute(
        select(Account).where(Account.id == data.account_id, Account.user_id == user_id)
    )
    if account_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if data.category_id is not None:
        cat_result = await db.execute(
            select(Category).where(
                Category.id == data.category_id, Category.user_id == user_id
            )
        )
        if cat_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Category not found")

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

    await apply_balance_change(
        db, data.account_id, user_id, data.amount, data.transaction_type
    )

    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    await _invalidate_user_reports(user_id)
    if data.is_recurring and data.transaction_type == TransactionType.EXPENSE:
        await _emit_recurring_payment_event(
            user_id, data.description or "", data.recurring_day
        )
    accounts = await _load_accounts(db, user_id, {txn.account_id})
    categories = await _load_categories(
        db, user_id, {txn.category_id} if txn.category_id else set()
    )
    return _enrich_transaction(txn, accounts, categories)
