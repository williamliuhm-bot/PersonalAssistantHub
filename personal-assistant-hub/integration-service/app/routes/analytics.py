from typing import List

from fastapi import APIRouter, Depends, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.insight_i18n import localize_insight, localize_recommendation
from app.database import get_db
from app.models import BudgetForecast, ProductivityReport
from app.schemas import (
    BudgetForecastOut,
    CorrelationData,
    InsightOut,
    ProductivityReportOut,
)

router = APIRouter(tags=["analytics"])


@router.get(
    "/api/analytics/productivity-reports",
    response_model=List[ProductivityReportOut],
)
async def get_productivity_reports(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    result = await db.execute(
        select(ProductivityReport)
        .where(ProductivityReport.user_id == user_id)
        .order_by(desc(ProductivityReport.report_date))
        .limit(30)
    )
    reports = result.scalars().all()
    for report in reports:
        if report.insight:
            report.insight = localize_insight(report.insight)
    return reports


@router.get(
    "/api/analytics/budget-forecasts",
    response_model=List[BudgetForecastOut],
)
async def get_budget_forecasts(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    result = await db.execute(
        select(BudgetForecast)
        .where(BudgetForecast.user_id == user_id)
        .order_by(desc(BudgetForecast.forecast_date))
        .limit(30)
    )
    forecasts = result.scalars().all()
    for forecast in forecasts:
        if forecast.recommendation:
            forecast.recommendation = localize_recommendation(forecast.recommendation)
    return forecasts


@router.get("/api/analytics/correlation", response_model=CorrelationData)
async def get_correlation_data(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    result = await db.execute(
        select(ProductivityReport)
        .where(ProductivityReport.user_id == user_id)
        .order_by(ProductivityReport.report_date)
        .limit(90)
    )
    reports = result.scalars().all()

    dates = [r.report_date.isoformat() for r in reports]
    tasks = [r.tasks_completed for r in reports]
    expenses = [r.total_expenses for r in reports]
    latest_corr = reports[-1].correlation_score if reports else 0.0

    return CorrelationData(
        dates=dates,
        tasks_completed=tasks,
        expenses=expenses,
        correlation_score=latest_corr,
    )


@router.get("/api/analytics/insights", response_model=InsightOut)
async def get_insights(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    result = await db.execute(
        select(ProductivityReport)
        .where(ProductivityReport.user_id == user_id)
        .order_by(desc(ProductivityReport.created_at))
        .limit(1)
    )
    report = result.scalar_one_or_none()
    insight_text = localize_insight(report.insight if report else None)
    return InsightOut(insight=insight_text)
