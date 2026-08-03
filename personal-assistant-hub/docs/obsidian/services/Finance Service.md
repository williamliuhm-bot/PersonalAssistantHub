---
tags:
  - pah
  - service
---

# Finance Service

**Порт:** 8002 · папка `finance-service/`

![[assets/ui-finance.png]]

## Модели (фрагмент)

```python
# finance-service/app/models.py
class Account(Base):
    __tablename__ = "accounts"
    user_id: Mapped[int]
    name: Mapped[str]
    type: Mapped[AccountType]  # CASH | BANK | CARD | SAVINGS
    balance: Mapped[Decimal]
    currency: Mapped[str]  # ISO-4217, default USD

class Transaction(Base):
    __tablename__ = "transactions"
    account_id: Mapped[int]
    category_id: Mapped[int | None]
    amount: Mapped[Decimal]
    transaction_type: Mapped[TransactionType]
    is_recurring: Mapped[bool]
    recurring_day: Mapped[int | None]
```

## Internal API
`/api/internal/*` — для [[Telegram]]-бота, заголовок/токен `INTERNAL_SERVICE_TOKEN`.

## Клиент
`/finance`, виджеты Dashboard, Mini App `/tg`. Модуль: [[Финансы]].

## См. также

[[Доменная модель]] · [[Notification Service]] · [[Integration Service]]
