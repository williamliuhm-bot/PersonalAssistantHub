import sys
from decimal import Decimal
from pathlib import Path

import pytest

for mod in list(sys.modules.keys()):
    if mod.startswith("app"):
        del sys.modules[mod]
SERVICE_DIR = str(Path(__file__).resolve().parent.parent / "finance-service")
sys.path = [p for p in sys.path if "auth-service" not in p and "finance-service" not in p and "tasks-service" not in p]
sys.path.insert(0, SERVICE_DIR)

from app.currency_utils import to_rub, BASE_CURRENCY  # noqa: E402


def test_to_rub_rub_unchanged():
    assert to_rub(100, "RUB") == Decimal("100.00")
    assert to_rub("50.5", None) == Decimal("50.50")


def test_to_rub_usd_default_rate():
    assert to_rub(10, "USD") == Decimal("900.00")


def test_to_rub_eur_default_rate():
    assert to_rub(10, "EUR") == Decimal("980.00")


def test_to_rub_gbp_default_rate():
    assert to_rub(10, "GBP") == Decimal("1150.00")


def test_to_rub_custom_env_rate(monkeypatch):
    monkeypatch.setenv("RATE_USD_RUB", "100")
    assert to_rub(5, "USD") == Decimal("500.00")


def test_base_currency_constant():
    assert BASE_CURRENCY == "RUB"
