import asyncio
import calendar
import logging
from datetime import date, datetime, timedelta, timezone

import numpy as np
from scipy import stats

from app.celery_app import celery_app
from app.database import async_session
from app.db_queries import (
    create_payment_reminder_task,
    fetch_all_user_ids,
    fetch_budget_forecast_inputs,
    fetch_completed_tasks_by_date,
    fetch_daily_expenses,
)
from app.models import BudgetForecast, ProductivityReport, RiskLevel

logger = logging.getLogger(__name__)


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task
def auto_create_task_from_payment(event_data: dict):
    run_async(_auto_create_task_from_payment_async(event_data))


async def _auto_create_task_from_payment_async(event_data: dict):
    if event_data.get("event_type") != "recurring_payment_created":
        return

    data = event_data.get("data", {})
    description = data.get("description", "")
    recurring_day = data.get("recurring_day", 1)
    user_id = event_data.get("user_id")

    if not description or not user_id:
        return

    due_day = max(int(recurring_day) - 1, 1)
    today = date.today()
    try:
        due_date = date(today.year, today.month, due_day)
        if due_date < today:
            if today.month == 12:
                due_date = date(today.year + 1, 1, due_day)
            else:
                due_date = date(today.year, today.month + 1, due_day)
    except ValueError:
        due_date = today + timedelta(days=1)

    deadline = datetime.combine(due_date, datetime.min.time(), tzinfo=timezone.utc)
    title = f"Pay {description}"

    async with async_session() as session:
        try:
            await create_payment_reminder_task(
                session,
                user_id=int(user_id),
                title=title,
                deadline_iso=deadline.isoformat(),
            )
            logger.info("Created payment reminder task for user %s: %s", user_id, title)
        except Exception:
            logger.exception("Failed to create task from recurring payment for user %s", user_id)


@celery_app.task
def analyze_productivity():
    run_async(_analyze_productivity_async())


async def _analyze_productivity_async():
    async with async_session() as session:
        user_ids = await fetch_all_user_ids(session)

    for user_id in user_ids:
        await _analyze_user_productivity(user_id)


async def _analyze_user_productivity(user_id: int):
    async with async_session() as session:
        task_counts = await fetch_completed_tasks_by_date(session, user_id)
        daily_expenses, daily_entertainment = await fetch_daily_expenses(session, user_id)

    common_dates = sorted(set(task_counts.keys()) & set(daily_expenses.keys()))

    if len(common_dates) < 3:
        correlation_score = 0.0
        insight = "Недостаточно данных для анализа продуктивности."
    else:
        x = np.array([task_counts[d] for d in common_dates], dtype=float)
        y = np.array([daily_expenses[d] for d in common_dates], dtype=float)

        try:
            r, _ = stats.pearsonr(x, y)
            correlation_score = round(float(r), 4)
        except Exception:
            correlation_score = 0.0

        median_x = float(np.median(x))
        low_prod_days = [d for d in common_dates if task_counts[d] <= median_x]
        high_prod_days = [d for d in common_dates if d not in low_prod_days]

        if low_prod_days:
            avg_ent_low = float(np.mean([daily_entertainment.get(d, 0) for d in low_prod_days]))
            avg_ent_high = (
                float(np.mean([daily_entertainment.get(d, 0) for d in high_prod_days]))
                if high_prod_days
                else 0.0
            )
            if avg_ent_high > 0:
                pct_diff = round((avg_ent_low - avg_ent_high) / avg_ent_high * 100, 1)
                if pct_diff > 0:
                    insight = (
                        f"В дни с низкой продуктивностью расходы на развлечения "
                        f"на {pct_diff}% выше"
                    )
                else:
                    insight = (
                        f"В дни с низкой продуктивностью расходы на развлечения "
                        f"на {abs(pct_diff)}% ниже"
                    )
            else:
                insight = "Продуктивность и расходы связаны умеренно."
        else:
            insight = (
                "Значимой связи между продуктивностью и расходами на развлечения не обнаружено."
            )

    avg_total = float(np.mean([daily_expenses[d] for d in common_dates])) if common_dates else 0.0
    avg_ent = (
        float(np.mean([daily_entertainment.get(d, 0) for d in common_dates]))
        if common_dates
        else 0.0
    )

    report = ProductivityReport(
        user_id=user_id,
        report_date=date.today(),
        tasks_completed=sum(task_counts.values()),
        total_expenses=round(avg_total, 2),
        entertainment_expenses=round(avg_ent, 2),
        correlation_score=correlation_score,
        insight=insight,
    )

    async with async_session() as session:
        session.add(report)
        await session.commit()


@celery_app.task
def forecast_budget():
    run_async(_forecast_budget_async())


async def _forecast_budget_async():
    async with async_session() as session:
        user_ids = await fetch_all_user_ids(session)

    today = date.today()
    for user_id in user_ids:
        await _forecast_user_budget(user_id, today)


async def _forecast_user_budget(user_id: int, today: date):
    async with async_session() as session:
        budget_limit, recurring_total, spent_this_month = await fetch_budget_forecast_inputs(
            session, user_id, today
        )

    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_elapsed = max(today.day, 1)
    daily_avg = spent_this_month / days_elapsed
    projected_remaining = daily_avg * max(days_in_month - days_elapsed, 0)
    predicted = spent_this_month + projected_remaining + recurring_total

    if budget_limit > 0:
        ratio = predicted / budget_limit
        if ratio > 0.9:
            risk_level = RiskLevel.HIGH
            recommendation = (
                "Прогноз расходов превышает 90% лимита бюджета. "
                "Рекомендуем сократить необязательные траты."
            )
        elif ratio > 0.7:
            risk_level = RiskLevel.MEDIUM
            recommendation = (
                "Прогноз расходов приближается к лимиту бюджета. Следите за тратами."
            )
        else:
            risk_level = RiskLevel.LOW
            recommendation = "Бюджет в норме. Продолжайте в том же духе."
    else:
        risk_level = RiskLevel.MEDIUM
        recommendation = "Задайте лимит бюджета, чтобы включить прогноз и оценку рисков."

    forecast = BudgetForecast(
        user_id=user_id,
        forecast_date=today,
        predicted_expenses=round(predicted, 2),
        budget_limit=round(budget_limit, 2),
        risk_level=risk_level,
        recommendation=recommendation,
    )

    async with async_session() as session:
        session.add(forecast)
        await session.commit()
