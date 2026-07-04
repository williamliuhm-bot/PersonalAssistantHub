import sys
from decimal import Decimal
from pathlib import Path

import pytest

SCRIPTS_DIR = str(Path(__file__).resolve().parent.parent / "scripts")
sys.path.insert(0, SCRIPTS_DIR)

from seed_data import random_amount, AccountType, CategoryType, TransactionType, BudgetPeriod  # noqa: E402


def test_random_amount_in_range():
    for _ in range(20):
        value = random_amount(10.0, 20.0)
        assert Decimal("10.0") <= value <= Decimal("20.0")


def test_random_amount_single_value_range():
    value = random_amount(5.0, 5.0)
    assert value == Decimal("5.0")


def test_seed_enums_account_type():
    assert AccountType.CASH.value == "cash"
    assert AccountType.BANK.value == "bank"


def test_seed_enums_category_type():
    assert CategoryType.INCOME.value == "Income"
    assert CategoryType.EXPENSE.value == "Expense"


def test_seed_enums_transaction_type():
    assert TransactionType.INCOME.value == "income"
    assert TransactionType.EXPENSE.value == "expense"


def test_seed_enums_budget_period():
    assert BudgetPeriod.MONTHLY.value == "monthly"
    assert BudgetPeriod.WEEKLY.value == "weekly"
    assert BudgetPeriod.YEARLY.value == "yearly"


def test_seed_script_has_main():
    seed_path = Path(SCRIPTS_DIR) / "seed_data.py"
    content = seed_path.read_text(encoding="utf-8")
    assert "async def main" in content
    assert 'if __name__ == "__main__"' in content
    assert "demo@example.com" in content
