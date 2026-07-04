import pytest
import sys
from pathlib import Path

for mod in list(sys.modules.keys()):
    if mod.startswith("app"):
        del sys.modules[mod]
SERVICE_DIR = str(Path(__file__).resolve().parent.parent / "finance-service")
sys.path = [p for p in sys.path if "auth-service" not in p and "finance-service" not in p and "tasks-service" not in p]
sys.path.insert(0, SERVICE_DIR)

from app.schemas import TransactionUpdate  # noqa: E402


def test_transaction_update_accepts_date_field():
    payload = TransactionUpdate(amount=10, date="2026-07-04")
    assert payload.date.isoformat() == "2026-07-04"


def test_transaction_update_date_can_be_none():
    payload = TransactionUpdate(amount=10)
    assert payload.date is None
