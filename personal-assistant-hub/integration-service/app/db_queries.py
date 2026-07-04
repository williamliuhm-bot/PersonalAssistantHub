"""Read-only SQL helpers against the shared PostgreSQL schema."""

from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_all_user_ids(session: AsyncSession) -> list[int]:
    result = await session.execute(text("SELECT id FROM users ORDER BY id"))
    return [row[0] for row in result.fetchall()]


async def fetch_completed_tasks_by_date(session: AsyncSession, user_id: int) -> dict[str, int]:
    result = await session.execute(
        text(
            """
            SELECT DATE(updated_at AT TIME ZONE 'UTC') AS d, COUNT(*)::int AS cnt
            FROM tasks
            WHERE user_id = :uid AND status = 'DONE'
            GROUP BY DATE(updated_at AT TIME ZONE 'UTC')
            """
        ),
        {"uid": user_id},
    )
    return {row[0].isoformat(): row[1] for row in result.fetchall()}


async def fetch_daily_expenses(session: AsyncSession, user_id: int) -> tuple[dict[str, float], dict[str, float]]:
    result = await session.execute(
        text(
            """
            SELECT
                t.date::text AS d,
                COALESCE(SUM(t.amount), 0)::float AS total,
                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(c.name) IN (
                                'entertainment', 'fun', 'leisure', 'развлечения', 'досуг'
                            )
                            THEN t.amount
                            ELSE 0
                        END
                    ),
                    0
                )::float AS entertainment
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = :uid AND t.transaction_type = 'expense'
            GROUP BY t.date
            """
        ),
        {"uid": user_id},
    )
    daily_expenses: dict[str, float] = {}
    daily_entertainment: dict[str, float] = {}
    for row in result.fetchall():
        daily_expenses[row[0]] = row[1]
        daily_entertainment[row[0]] = row[2]
    return daily_expenses, daily_entertainment


async def fetch_budget_forecast_inputs(
    session: AsyncSession, user_id: int, today: date
) -> tuple[float, float, float]:
    month_start = today.replace(day=1)

    budget_result = await session.execute(
        text(
            """
            SELECT COALESCE(SUM(limit_amount), 0)::float
            FROM budgets
            WHERE user_id = :uid
            """
        ),
        {"uid": user_id},
    )
    budget_limit = budget_result.scalar() or 0.0

    recurring_result = await session.execute(
        text(
            """
            SELECT COALESCE(SUM(amount), 0)::float
            FROM transactions
            WHERE user_id = :uid
              AND is_recurring = true
              AND transaction_type = 'expense'
            """
        ),
        {"uid": user_id},
    )
    recurring_total = recurring_result.scalar() or 0.0

    spent_result = await session.execute(
        text(
            """
            SELECT COALESCE(SUM(amount), 0)::float
            FROM transactions
            WHERE user_id = :uid
              AND transaction_type = 'expense'
              AND date >= :month_start
              AND date <= :today
            """
        ),
        {"uid": user_id, "month_start": month_start, "today": today},
    )
    spent_this_month = spent_result.scalar() or 0.0

    return budget_limit, recurring_total, spent_this_month


async def create_payment_reminder_task(
    session: AsyncSession,
    user_id: int,
    title: str,
    deadline_iso: str,
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO tasks (user_id, title, description, priority, status, deadline)
            VALUES (:uid, :title, '', 'MEDIUM', 'TODO', :deadline::timestamptz)
            """
        ),
        {"uid": user_id, "title": title, "deadline": deadline_iso},
    )
    await session.commit()
