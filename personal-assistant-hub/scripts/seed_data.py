#!/usr/bin/env python3
"""Seed data script for Personal Assistant Hub."""

import asyncio
import os
import random
from datetime import datetime, date, timedelta
from decimal import Decimal
from enum import Enum as PyEnum

import bcrypt
from sqlalchemy import (
    Column, Integer, String, DateTime, Enum as SAEnum,
    DECIMAL, Boolean, Text, ForeignKey, Date, Float,
)
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://app:app_secret_2024@localhost:5432/personal_assistant_hub",
)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class AccountType(str, PyEnum):
    CASH = "CASH"
    BANK = "BANK"
    CARD = "CARD"
    SAVINGS = "SAVINGS"


class CategoryType(str, PyEnum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class TransactionType(str, PyEnum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    TRANSFER = "TRANSFER"


class TaskStatus(str, PyEnum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class TaskPriority(str, PyEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class HabitFrequency(str, PyEnum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"


class BudgetPeriod(str, PyEnum):
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(SAEnum(AccountType), nullable=False, default=AccountType.BANK)
    balance = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    currency = Column(String(3), nullable=False, default="USD")


class Category(Base, TimestampMixin):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(SAEnum(CategoryType), nullable=False)
    icon = Column(String(50), nullable=True)
    color = Column(String(7), nullable=True)


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    amount = Column(DECIMAL(15, 2), nullable=False)
    description = Column(Text, nullable=True)
    transaction_type = Column(SAEnum(TransactionType), nullable=False)
    date = Column(Date, nullable=False, server_default=func.current_date())
    is_recurring = Column(Boolean, default=False)
    recurring_day = Column(Integer, nullable=True)


class Budget(Base, TimestampMixin):
    __tablename__ = "budgets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    limit_amount = Column(DECIMAL(15, 2), nullable=False)
    spent_amount = Column(DECIMAL(15, 2), default=Decimal("0.00"))
    period = Column(SAEnum(BudgetPeriod), nullable=False, default=BudgetPeriod.MONTHLY)


class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(SAEnum(TaskPriority), nullable=False, default=TaskPriority.MEDIUM)
    status = Column(SAEnum(TaskStatus), nullable=False, default=TaskStatus.TODO)
    deadline = Column(Date, nullable=True)
    order_index = Column(Integer, default=0)


class Habit(Base, TimestampMixin):
    __tablename__ = "habits"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    frequency = Column(SAEnum(HabitFrequency), nullable=False, default=HabitFrequency.DAILY)
    streak = Column(Integer, default=0)
    last_completed = Column(Date, nullable=True)
    color = Column(String(7), nullable=True, default="#10B981")


class HabitLog(Base):
    __tablename__ = "habit_logs"
    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    completed_date = Column(Date, nullable=False)


class RiskLevel(str, PyEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ProductivityReport(Base):
    __tablename__ = "productivity_reports"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    report_date = Column(Date, nullable=False)
    tasks_completed = Column(Integer, default=0)
    total_expenses = Column(DECIMAL(15, 2), default=Decimal("0.00"))
    entertainment_expenses = Column(DECIMAL(15, 2), default=Decimal("0.00"))
    correlation_score = Column(Float, nullable=True)
    insight = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class BudgetForecast(Base):
    __tablename__ = "budget_forecasts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    forecast_date = Column(Date, nullable=False)
    predicted_expenses = Column(DECIMAL(15, 2), default=Decimal("0.00"))
    budget_limit = Column(DECIMAL(15, 2), default=Decimal("0.00"))
    risk_level = Column(SAEnum(RiskLevel), default=RiskLevel.LOW)
    recommendation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


FOOD_DESCRIPTIONS = [
    "Grocery shopping at Walmart", "Lunch at Subway", "Dinner at Italian restaurant",
    "Coffee from Starbucks", "Pizza delivery", "Weekly groceries at Trader Joe's",
    "Sushi dinner", "Breakfast at local cafe", "Mexican takeout", "Thai food delivery",
    "Burger and fries", "Salad bar lunch", "Bakery items", "Farmers market produce",
    "Chinese takeout", "Ice cream dessert", "Sandwich shop lunch", "BBQ dinner out",
]

TRANSPORT_DESCRIPTIONS = [
    "Gas station fill-up", "Uber ride to work", "Monthly metro pass",
    "Bus fare", "Taxi from airport", "Parking garage fee",
    "Car wash", "Tire rotation service", "Oil change", "Train ticket",
]

ENTERTAINMENT_DESCRIPTIONS = [
    "Netflix subscription", "Movie tickets", "Concert tickets",
    "Spotify premium", "Streaming service", "Bowling night",
    "Mini golf outing", "Cinema popcorn & drinks", "Video game purchase",
    "Board game cafe", "Arcade games", "Theater play tickets",
]

UTILITIES_DESCRIPTIONS = [
    "Electric bill", "Water bill", "Internet service",
    "Phone plan", "Gas bill", "Trash collection",
]

SHOPPING_DESCRIPTIONS = [
    "New running shoes", "Clothes from H&M", "Amazon order",
    "Electronics accessories", "Home decor", "Kitchen supplies",
    "Office supplies", "Books from bookstore", "Gardening tools",
    "Bed sheets and towels", "Backpack", "Winter jacket",
]

HEALTH_DESCRIPTIONS = [
    "Pharmacy - vitamins", "Doctor visit copay", "Dental checkup",
    "Gym membership", "Eye exam", "Prescription refill",
    "Physical therapy session", "Massage therapy", "Yoga class",
]

EDUCATION_DESCRIPTIONS = [
    "Online course subscription", "Programming books", "Udemy course",
    "Language learning app", "Workshop registration", "Study materials",
]

SALARY_DESCRIPTION = "Monthly salary payment"
FREELANCE_DESCRIPTIONS = [
    "Web development project", "UI/UX design gig", "Consulting call",
    "Freelance writing", "Code review project", "Technical tutorial",
]


def random_amount(min_v: float, max_v: float) -> Decimal:
    return Decimal(str(round(random.uniform(min_v, max_v), 2)))


async def main():
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        existing = await session.execute(User.__table__.select().where(User.email == "demo@example.com"))
        if existing.first():
            print("Demo user already exists. Skipping seed.")
            await engine.dispose()
            return

        print("Creating demo user...")
        password_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()
        user = User(email="demo@example.com", username="demo", password_hash=password_hash)
        session.add(user)
        await session.flush()
        user_id = user.id
        print(f"  -> User ID: {user_id}")

        print("Creating accounts...")
        cash = Account(user_id=user_id, name="Cash", type=AccountType.CASH, balance=Decimal("500.00"))
        bank = Account(user_id=user_id, name="Bank Account", type=AccountType.BANK, balance=Decimal("5000.00"))
        card = Account(user_id=user_id, name="Credit Card", type=AccountType.CARD, balance=Decimal("-200.00"))
        session.add_all([cash, bank, card])
        await session.flush()
        accounts = {"cash": cash.id, "bank": bank.id, "card": card.id}
        print(f"  -> Cash={cash.id}, Bank={bank.id}, CreditCard={card.id}")

        print("Creating categories...")
        cat_salary = Category(user_id=user_id, name="Salary", type=CategoryType.INCOME, icon="briefcase", color="#10B981")
        cat_freelance = Category(user_id=user_id, name="Freelance", type=CategoryType.INCOME, icon="laptop", color="#3B82F6")
        cat_food = Category(user_id=user_id, name="Food", type=CategoryType.EXPENSE, icon="shopping-cart", color="#F59E0B")
        cat_transport = Category(user_id=user_id, name="Transport", type=CategoryType.EXPENSE, icon="truck", color="#8B5CF6")
        cat_entertainment = Category(user_id=user_id, name="Entertainment", type=CategoryType.EXPENSE, icon="film", color="#EC4899")
        cat_utilities = Category(user_id=user_id, name="Utilities", type=CategoryType.EXPENSE, icon="zap", color="#EF4444")
        cat_shopping = Category(user_id=user_id, name="Shopping", type=CategoryType.EXPENSE, icon="shopping-bag", color="#F97316")
        cat_health = Category(user_id=user_id, name="Health", type=CategoryType.EXPENSE, icon="heart", color="#14B8A6")
        cat_education = Category(user_id=user_id, name="Education", type=CategoryType.EXPENSE, icon="book", color="#6366F1")
        session.add_all([cat_salary, cat_freelance, cat_food, cat_transport, cat_entertainment, cat_utilities, cat_shopping, cat_health, cat_education])
        await session.flush()
        cats = {
            "salary": cat_salary.id, "freelance": cat_freelance.id,
            "food": cat_food.id, "transport": cat_transport.id,
            "entertainment": cat_entertainment.id, "utilities": cat_utilities.id,
            "shopping": cat_shopping.id, "health": cat_health.id,
            "education": cat_education.id,
        }
        print(f"  -> {len(cats)} categories created")

        print("Creating 60+ transactions...")
        today = date.today()
        three_months_ago = today - timedelta(days=90)
        txn_count = 0

        for month_offset in range(3):
            month_date = (today.replace(day=1) - timedelta(days=month_offset * 30)).replace(day=1)
            month_start = month_date
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1, day=1) - timedelta(days=1)

            salary_day = min(month_start.day, 1)
            payday = month_start.replace(day=min(salary_day, 28))
            session.add(Transaction(
                user_id=user_id, account_id=accounts["bank"], category_id=cats["salary"],
                amount=Decimal("3500.00"), description=SALARY_DESCRIPTION,
                transaction_type=TransactionType.INCOME, date=payday,
            ))
            txn_count += 1

            if month_offset > 0:
                freelance_day = min(random.randint(10, 25), 28)
                freq_date = month_start.replace(day=freelance_day)
                session.add(Transaction(
                    user_id=user_id, account_id=accounts["bank"], category_id=cats["freelance"],
                    amount=random_amount(200, 1500), description=random.choice(FREELANCE_DESCRIPTIONS),
                    transaction_type=TransactionType.INCOME, date=freq_date,
                ))
                txn_count += 1

            def random_day_in_month():
                max_d = month_end.day
                return month_start.replace(day=random.randint(1, max_d))

            for _ in range(random.randint(6, 9)):
                txn_date = month_start.replace(day=random.randint(1, month_end.day))
                session.add(Transaction(
                    user_id=user_id, account_id=random.choice([accounts["cash"], accounts["card"]]),
                    category_id=cats["food"], amount=random_amount(15, 80),
                    description=random.choice(FOOD_DESCRIPTIONS),
                    transaction_type=TransactionType.EXPENSE, date=txn_date,
                ))
                txn_count += 1

            for _ in range(random.randint(3, 5)):
                txn_date = month_start.replace(day=random.randint(1, month_end.day))
                session.add(Transaction(
                    user_id=user_id, account_id=accounts["card"],
                    category_id=cats["transport"], amount=random_amount(20, 50),
                    description=random.choice(TRANSPORT_DESCRIPTIONS),
                    transaction_type=TransactionType.EXPENSE, date=txn_date,
                ))
                txn_count += 1

            for _ in range(random.randint(2, 4)):
                txn_date = month_start.replace(day=random.randint(1, month_end.day))
                session.add(Transaction(
                    user_id=user_id, account_id=accounts["card"],
                    category_id=cats["entertainment"], amount=random_amount(30, 150),
                    description=random.choice(ENTERTAINMENT_DESCRIPTIONS),
                    transaction_type=TransactionType.EXPENSE, date=txn_date,
                ))
                txn_count += 1

            txn_date = month_start.replace(day=random.randint(5, 10))
            session.add(Transaction(
                user_id=user_id, account_id=accounts["bank"],
                category_id=cats["utilities"], amount=random_amount(150, 250),
                description=random.choice(UTILITIES_DESCRIPTIONS),
                transaction_type=TransactionType.EXPENSE, date=txn_date,
            ))
            txn_count += 1

            for _ in range(random.randint(1, 3)):
                txn_date = month_start.replace(day=random.randint(1, month_end.day))
                session.add(Transaction(
                    user_id=user_id, account_id=accounts["card"],
                    category_id=cats["shopping"], amount=random_amount(50, 500),
                    description=random.choice(SHOPPING_DESCRIPTIONS),
                    transaction_type=TransactionType.EXPENSE, date=txn_date,
                ))
                txn_count += 1

            for _ in range(random.randint(1, 2)):
                txn_date = month_start.replace(day=random.randint(1, month_end.day))
                session.add(Transaction(
                    user_id=user_id, account_id=accounts["cash"],
                    category_id=cats["health"], amount=random_amount(30, 200),
                    description=random.choice(HEALTH_DESCRIPTIONS),
                    transaction_type=TransactionType.EXPENSE, date=txn_date,
                ))
                txn_count += 1

            txn_date = month_start.replace(day=random.randint(15, 25))
            session.add(Transaction(
                user_id=user_id, account_id=accounts["bank"],
                category_id=cats["education"], amount=random_amount(20, 300),
                description=random.choice(EDUCATION_DESCRIPTIONS),
                transaction_type=TransactionType.EXPENSE, date=txn_date,
            ))
            txn_count += 1

        print(f"  -> {txn_count} transactions created")

        print("Creating budgets...")
        budgets_data = [
            (cats["food"], Decimal("800.00")),
            (cats["transport"], Decimal("200.00")),
            (cats["entertainment"], Decimal("300.00")),
            (cats["utilities"], Decimal("250.00")),
            (cats["shopping"], Decimal("400.00")),
            (cats["health"], Decimal("200.00")),
        ]
        for cat_id, limit in budgets_data:
            session.add(Budget(user_id=user_id, category_id=cat_id, limit_amount=limit, period=BudgetPeriod.MONTHLY))
        await session.flush()
        print(f"  -> {len(budgets_data)} budgets created")

        print("Creating projects...")
        proj_personal = Project(user_id=user_id, name="Personal", description="Personal projects and tasks")
        proj_work = Project(user_id=user_id, name="Work", description="Work-related projects and tasks")
        proj_health = Project(user_id=user_id, name="Health", description="Health and wellness goals")
        session.add_all([proj_personal, proj_work, proj_health])
        await session.flush()
        projects = {"personal": proj_personal.id, "work": proj_work.id, "health": proj_health.id}
        print(f"  -> 3 projects created")

        print("Creating 20+ tasks...")
        tasks_data = [
            ("Plan weekend trip", TaskPriority.LOW, TaskStatus.TODO, projects["personal"]),
            ("Organize closet", TaskPriority.MEDIUM, TaskStatus.TODO, projects["personal"]),
            ("Read 'Atomic Habits'", TaskPriority.LOW, TaskStatus.DONE, projects["personal"]),
            ("Fix bike tire", TaskPriority.MEDIUM, TaskStatus.IN_PROGRESS, projects["personal"]),
            ("Renew passport", TaskPriority.HIGH, TaskStatus.TODO, projects["personal"]),
            ("Complete Q2 report", TaskPriority.CRITICAL, TaskStatus.IN_PROGRESS, projects["work"]),
            ("Prepare presentation slides", TaskPriority.HIGH, TaskStatus.TODO, projects["work"]),
            ("Send weekly status email", TaskPriority.MEDIUM, TaskStatus.DONE, projects["work"]),
            ("Review team pull requests", TaskPriority.MEDIUM, TaskStatus.IN_PROGRESS, projects["work"]),
            ("Update project documentation", TaskPriority.LOW, TaskStatus.TODO, projects["work"]),
            ("Schedule team meeting", TaskPriority.MEDIUM, TaskStatus.DONE, projects["work"]),
            ("Code review for feature branch", TaskPriority.HIGH, TaskStatus.TODO, projects["work"]),
            ("Run daily workout", TaskPriority.HIGH, TaskStatus.DONE, projects["health"]),
            ("Schedule doctor appointment", TaskPriority.HIGH, TaskStatus.TODO, projects["health"]),
            ("Meal prep for week", TaskPriority.MEDIUM, TaskStatus.IN_PROGRESS, projects["health"]),
            ("Buy vitamins", TaskPriority.LOW, TaskStatus.DONE, projects["health"]),
            ("Book dental checkup", TaskPriority.MEDIUM, TaskStatus.TODO, projects["health"]),
            ("Update LinkedIn profile", TaskPriority.LOW, TaskStatus.TODO, None),
            ("Call parents", TaskPriority.MEDIUM, TaskStatus.DONE, None),
            ("Pay credit card bill", TaskPriority.CRITICAL, TaskStatus.TODO, None),
            ("Back up laptop", TaskPriority.MEDIUM, TaskStatus.IN_PROGRESS, None),
            ("Plan birthday gift", TaskPriority.LOW, TaskStatus.TODO, None),
        ]
        for i, (title, priority, status, project_id) in enumerate(tasks_data):
            deadline_date = today + timedelta(days=random.randint(1, 30)) if status == TaskStatus.TODO else None
            session.add(Task(
                user_id=user_id, project_id=project_id, title=title,
                description=f"Task: {title}", priority=priority, status=status,
                deadline=deadline_date, order_index=i,
            ))
        await session.flush()
        print(f"  -> {len(tasks_data)} tasks created")

        print("Creating habits...")
        habit_drink = Habit(user_id=user_id, title="Drink Water", description="Drink 8 glasses of water daily", frequency=HabitFrequency.DAILY, color="#3B82F6")
        habit_read = Habit(user_id=user_id, title="Read 30min", description="Read for at least 30 minutes", frequency=HabitFrequency.DAILY, color="#8B5CF6")
        habit_exercise = Habit(user_id=user_id, title="Exercise", description="Work out for at least 20 minutes", frequency=HabitFrequency.DAILY, color="#10B981")
        habit_meditate = Habit(user_id=user_id, title="Meditate", description="Meditate for 10 minutes", frequency=HabitFrequency.DAILY, color="#F59E0B")
        habit_english = Habit(user_id=user_id, title="Learn English", description="Practice English for 15 minutes", frequency=HabitFrequency.DAILY, color="#EC4899")
        session.add_all([habit_drink, habit_read, habit_exercise, habit_meditate, habit_english])
        await session.flush()
        habits = {"drink": habit_drink.id, "read": habit_read.id, "exercise": habit_exercise.id, "meditate": habit_meditate.id, "english": habit_english.id}
        print(f"  -> {len(habits)} habits created")

        print("Creating habit logs for past 30 days...")
        log_count = 0
        for habit_name, habit_id in habits.items():
            skip_rate = {"drink": 0.05, "read": 0.2, "exercise": 0.3, "meditate": 0.15, "english": 0.25}
            for day_offset in range(30):
                log_date = today - timedelta(days=day_offset)
                if random.random() > skip_rate.get(habit_name, 0.1):
                    session.add(HabitLog(habit_id=habit_id, user_id=user_id, completed_date=log_date))
                    log_count += 1
        await session.flush()
        print(f"  -> {log_count} habit logs created")

        print("Creating productivity reports...")
        for day_offset in range(5):
            report_date = today - timedelta(days=day_offset * 7)
            tasks_done = random.randint(1, 6)
            total_exp = Decimal(str(round(random.uniform(50, 300), 2)))
            ent_exp = Decimal(str(round(random.uniform(0, 80), 2)))
            score = round(random.uniform(-0.3, 0.5), 2)
            session.add(ProductivityReport(
                user_id=user_id, report_date=report_date,
                tasks_completed=tasks_done, total_expenses=total_exp,
                entertainment_expenses=ent_exp, correlation_score=score,
                insight=f"Выполнено задач: {tasks_done}, расходы: {total_exp} $.",
            ))
        print(f"  -> 5 productivity reports created")

        print("Creating budget forecasts...")
        for day_offset in range(3):
            forecast_date = today + timedelta(days=7 * day_offset + 1)
            predicted = Decimal(str(round(random.uniform(1500, 2500), 2)))
            limit = Decimal("2200.00")
            risk = RiskLevel.LOW if predicted < limit else RiskLevel.MEDIUM
            session.add(BudgetForecast(
                user_id=user_id, forecast_date=forecast_date,
                predicted_expenses=predicted, budget_limit=limit,
                risk_level=risk,
                recommendation=(
                    f"Прогноз расходов: {predicted} $, лимит бюджета: {limit} $. Риск: средний."
                    if risk == RiskLevel.MEDIUM
                    else "Расходы укладываются в бюджет."
                ),
            ))
        await session.commit()
        print(f"  -> 3 budget forecasts created")

    await engine.dispose()
    print("\n== Seed data created successfully! ==")
    print("  Demo user: demo@example.com / password123")


if __name__ == "__main__":
    asyncio.run(main())
