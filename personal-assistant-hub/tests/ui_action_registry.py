"""Registry of UI buttons and their backing API endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class UiAction:
    page: str
    button: str
    method: str
    path: str
    service: str  # finance | tasks | auth | notifications
    setup: str | None = None  # fixture name hint
    body: dict[str, Any] | None = None
    path_params: dict[str, str] | None = None


FINANCE_ACTIONS: list[UiAction] = [
    UiAction("Finance", "Добавить счёт", "POST", "/api/accounts", "finance", body={"name": "UI Test", "type": "cash", "balance": 100}),
    UiAction("Finance", "Сохранить счёт", "PUT", "/api/accounts/{id}", "finance", setup="account_id"),
    UiAction("Finance", "Удалить счёт", "DELETE", "/api/accounts/{id}", "finance", setup="account_id"),
    UiAction("Finance", "Добавить транзакцию", "POST", "/api/transactions", "finance", setup="account_id"),
    UiAction("Finance", "Сохранить транзакцию", "PUT", "/api/transactions/{id}", "finance", setup="transaction_id"),
    UiAction("Finance", "Удалить транзакцию", "DELETE", "/api/transactions/{id}", "finance", setup="transaction_id"),
    UiAction("Finance", "Категории", "GET", "/api/categories", "finance"),
    UiAction("Finance", "Добавить категорию", "POST", "/api/categories", "finance", body={"name": "UI Cat", "type": "expense", "color": "#2563EB"}),
    UiAction("Finance", "Сохранить категорию", "PUT", "/api/categories/{id}", "finance", setup="category_id"),
    UiAction("Finance", "Удалить категорию", "DELETE", "/api/categories/{id}", "finance", setup="category_id"),
    UiAction("Finance", "Добавить бюджет", "POST", "/api/budgets", "finance", setup="category_id", body={"limit_amount": 1000, "period": "monthly"}),
    UiAction("Finance", "Удалить бюджет", "DELETE", "/api/budgets/{id}", "finance", setup="budget_id"),
    UiAction("Finance", "Текущий месяц (бюджеты)", "GET", "/api/budgets", "finance", path_params={"year": "2026", "month": "7"}),
    UiAction("Finance", "3 месяца (бюджеты)", "GET", "/api/budgets", "finance", path_params={"months": "3"}),
    UiAction("Finance", "Отчёт dashboard", "GET", "/api/reports/dashboard", "finance"),
    UiAction("Finance", "Разбивка по категориям", "GET", "/api/reports/category-breakdown", "finance", path_params={"year": "2026", "month": "7"}),
    UiAction("Finance", "Тренды", "GET", "/api/reports/monthly-trends", "finance", path_params={"months": "3"}),
    UiAction("Finance", "История баланса", "GET", "/api/reports/balance-history", "finance", path_params={"days": "30"}),
]

TASKS_ACTIONS: list[UiAction] = [
    UiAction("Tasks", "Добавить проект", "POST", "/api/projects", "tasks", body={"name": "UI Project"}),
    UiAction("Tasks", "Добавить задачу", "POST", "/api/tasks", "tasks", body={"title": "UI Task"}),
    UiAction("Tasks", "Обновить статус", "PATCH", "/api/tasks/{id}", "tasks", setup="task_id", body={"status": "done"}),
    UiAction("Tasks", "Добавить привычку", "POST", "/api/habits", "tasks", body={"title": "UI Habit", "frequency": "daily", "color": "#2563EB"}),
    UiAction("Tasks", "Отметить привычку", "POST", "/api/habits/{id}/log", "tasks", setup="habit_id"),
    UiAction("Habits", "Список привычек", "GET", "/api/habits", "tasks"),
]

ALL_UI_ACTIONS: list[UiAction] = FINANCE_ACTIONS + TASKS_ACTIONS
