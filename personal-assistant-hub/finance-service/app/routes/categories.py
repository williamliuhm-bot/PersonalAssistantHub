from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Category, Transaction, Budget
from app.schemas import CategoryCreate, CategoryUpdate, CategoryResponse
from app.auth import get_current_user_id
from app.cache import cache_invalidate

router = APIRouter(tags=["categories"])


async def _invalidate_user_reports(user_id: int) -> None:
    await cache_invalidate(f"report:*{user_id}*")


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.user_id == user_id).order_by(Category.name)
    )
    categories = result.scalars().all()
    return [CategoryResponse.model_validate(c) for c in categories]


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    category = Category(
        user_id=user_id,
        name=data.name,
        type=data.type,
        icon=data.icon,
        color=data.color,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    await _invalidate_user_reports(user_id)
    return CategoryResponse.model_validate(category)


@router.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return CategoryResponse.model_validate(category)


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    await _invalidate_user_reports(user_id)
    return CategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.execute(
        update(Transaction)
        .where(Transaction.category_id == category_id, Transaction.user_id == user_id)
        .values(category_id=None)
    )
    await db.execute(
        sa_delete(Budget).where(Budget.category_id == category_id, Budget.user_id == user_id)
    )
    await db.delete(category)
    await db.commit()
    await _invalidate_user_reports(user_id)
