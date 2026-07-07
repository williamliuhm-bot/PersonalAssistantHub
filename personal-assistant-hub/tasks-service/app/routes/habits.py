import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.models import Habit, HabitLog
from app.schemas import CalendarDay, HabitCreate, HabitLogResponse, HabitResponse, HabitUpdate

router = APIRouter(prefix="/api/habits", tags=["habits"])


def _habit_response(habit: Habit, today_count: int = 0) -> HabitResponse:
    return HabitResponse(
        id=habit.id,
        user_id=habit.user_id,
        title=habit.title,
        description=habit.description or "",
        frequency=(habit.frequency or "DAILY").lower(),
        times_per_day=habit.times_per_day or 1,
        today_count=today_count,
        streak=habit.streak or 0,
        last_completed=habit.last_completed,
        color=habit.color or "#6366f1",
        created_at=habit.created_at,
        updated_at=habit.updated_at,
    )


async def _today_counts(
    db: AsyncSession,
    user_id: int,
    habit_ids: list[int],
    day: datetime.date,
) -> dict[int, int]:
    if not habit_ids:
        return {}
    result = await db.execute(
        select(HabitLog.habit_id, func.count(HabitLog.id))
        .where(
            HabitLog.habit_id.in_(habit_ids),
            HabitLog.user_id == user_id,
            HabitLog.completed_date == day,
        )
        .group_by(HabitLog.habit_id)
    )
    return {habit_id: count for habit_id, count in result.fetchall()}


def _update_streak(habit: Habit, today: datetime.date, now: datetime.datetime) -> None:
    prev_completed = habit.last_completed
    freq = (habit.frequency or "").lower()

    if freq == "weekly":
        if prev_completed:
            delta = (today - prev_completed.date()).days
            habit.streak = habit.streak + 1 if 0 < delta <= 7 else 1
        else:
            habit.streak = 1
    elif freq == "monthly":
        if prev_completed:
            prev_d = prev_completed.date()
            months_diff = (today.year - prev_d.year) * 12 + (today.month - prev_d.month)
            habit.streak = habit.streak + 1 if months_diff == 1 else 1
        else:
            habit.streak = 1
    else:
        if prev_completed and (now - prev_completed).days <= 1:
            habit.streak += 1
        else:
            habit.streak = 1


@router.get("", response_model=list[HabitResponse])
async def list_habits(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.date.today()
    result = await db.execute(
        select(Habit).where(Habit.user_id == user_id).order_by(Habit.created_at)
    )
    habits = result.scalars().all()
    counts = await _today_counts(db, user_id, [h.id for h in habits], today)
    return [_habit_response(habit, counts.get(habit.id, 0)) for habit in habits]


@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(
    body: HabitCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    habit = Habit(
        user_id=user_id,
        title=body.title,
        description=body.description,
        frequency=body.frequency.upper() if body.frequency else "DAILY",
        times_per_day=body.times_per_day or 1,
        color=body.color,
    )
    db.add(habit)
    await db.commit()
    await db.refresh(habit)
    return _habit_response(habit, 0)


@router.get("/{habit_id}", response_model=HabitResponse)
async def get_habit(
    habit_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id))
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    counts = await _today_counts(db, user_id, [habit.id], datetime.date.today())
    return _habit_response(habit, counts.get(habit.id, 0))


@router.patch("/{habit_id}", response_model=HabitResponse)
async def update_habit(
    habit_id: int,
    body: HabitUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id))
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    update_data = body.model_dump(exclude_unset=True)
    if "frequency" in update_data and update_data["frequency"]:
        update_data["frequency"] = update_data["frequency"].upper()
    for key, value in update_data.items():
        setattr(habit, key, value)
    await db.commit()
    await db.refresh(habit)
    counts = await _today_counts(db, user_id, [habit.id], datetime.date.today())
    return _habit_response(habit, counts.get(habit.id, 0))


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    habit_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id))
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    await db.delete(habit)
    await db.commit()


@router.post("/{habit_id}/log", response_model=HabitLogResponse, status_code=status.HTTP_201_CREATED)
async def log_habit(
    habit_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id))
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")

    today = datetime.date.today()
    target = habit.times_per_day or 1
    counts = await _today_counts(db, user_id, [habit.id], today)
    today_count = counts.get(habit.id, 0)
    if today_count >= target:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Daily target already reached",
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    log = HabitLog(habit_id=habit_id, user_id=user_id, completed_date=today)
    db.add(log)
    habit.last_completed = now

    new_count = today_count + 1
    if new_count >= target:
        _update_streak(habit, today, now)

    await db.commit()
    await db.refresh(log)
    return log


@router.get("/{habit_id}/calendar")
async def get_habit_calendar(
    habit_id: int,
    year: int | None = None,
    month: int | None = None,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id))
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")

    today = datetime.date.today()
    year = year or today.year
    month = month or today.month
    if month < 1 or month > 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month")

    first_day = datetime.date(year, month, 1)
    if month == 12:
        last_day = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        last_day = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)

    logs_result = await db.execute(
        select(HabitLog.completed_date, func.count(HabitLog.id))
        .where(
            HabitLog.habit_id == habit_id,
            HabitLog.user_id == user_id,
            HabitLog.completed_date >= first_day,
            HabitLog.completed_date <= last_day,
        )
        .group_by(HabitLog.completed_date)
    )
    counts_by_date = {row[0]: row[1] for row in logs_result.fetchall()}
    target = habit.times_per_day or 1

    days = []
    current = first_day
    while current <= last_day:
        count = counts_by_date.get(current, 0)
        days.append(
            CalendarDay(
                date=current.isoformat(),
                completed=count >= target,
                count=count,
                target=target,
            )
        )
        current += datetime.timedelta(days=1)

    return {"habit_id": habit_id, "year": year, "month": month, "days": days}
