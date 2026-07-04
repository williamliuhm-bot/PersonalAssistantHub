import os
from decimal import Decimal

BASE_CURRENCY = "RUB"


def _rate(code: str) -> Decimal:
    env_key = f"RATE_{code}_RUB"
    defaults = {"USD": "90", "EUR": "98", "GBP": "115", "RUB": "1"}
    return Decimal(os.getenv(env_key, defaults.get(code, "1")))


def to_rub(amount: Decimal | float | int | str, currency: str | None) -> Decimal:
    value = Decimal(str(amount))
    code = (currency or BASE_CURRENCY).upper()
    if code == BASE_CURRENCY:
        return value.quantize(Decimal("0.01"))
    return (value * _rate(code)).quantize(Decimal("0.01"))
