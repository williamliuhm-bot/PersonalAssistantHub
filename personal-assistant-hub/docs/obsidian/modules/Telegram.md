---
tags:
  - pah
  - module
  - telegram
---

# Telegram

Сервис: [[Notification Service]] + internal API [[Finance Service]].

## Привязка
Настройки → Telegram → link-token / deep link `/start <code>`.

## Справка бота (из кода)

```text
/expense <сумма> [валюта] [@счёт] [категория] [описание]
/income  <сумма> [валюта] [@счёт] [категория] [описание]
/accounts · /categories · /balance · /app · /unlink · /help

Примеры:
/expense 350 Еда кофе
/expense 350 RUB Еда кофе
/expense 20 USD @Dollar Еда lunch
/income 50000 RUB счет:Зарплатная Зарплата
```

## Разбор команды

```python
# notification-service/app/telegram_service.py
async def handle_bot_command(db: AsyncSession, chat_id: int, text: str) -> str:
    ...
    if cmd in ("/expense", "/income"):
        tx_type = "expense" if cmd == "/expense" else "income"
        amount, currency, account_name, cat, desc = parse_tx_args(args)
        txn, err = await create_user_transaction(db, user_id, tx_type, ...)
```

## Mini App auth

```python
# notification-service/app/telegram_webapp.py
def validate_webapp_init_data(init_data: str, bot_token: str) -> dict:
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret_key, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        raise HTTPException(status_code=401, detail="Invalid initData signature")
```

- URL: `https://<DOMAIN>/tg`
- Gateway пропускает `/notification/api/telegram/webhook` и `.../webapp/auth` без JWT

## Доставка
- Prod: webhook `{API_PUBLIC_URL}/notification/api/telegram/webhook`
- Dev: `TELEGRAM_USE_POLLING=true`

## iOS Shortcuts
Собрать текст команды и **отправить сообщением** боту — не HTTP POST.

## См. также

[[Финансы]] · [[Уведомления]] · [[Конфигурация]] · [[Деплой]]
