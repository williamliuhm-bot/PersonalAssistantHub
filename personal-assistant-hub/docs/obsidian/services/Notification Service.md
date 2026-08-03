---
tags:
  - pah
  - service
---

# Notification Service

**Порт:** 8004 · папка `notification-service/`

## Возможности
- In-app inbox + Email / Telegram / Push (Celery)
- Бот + webhook/polling + Mini App auth

```python
# telegram_service.py — команды
HELP_TEXT = """Команды:
/expense <сумма> [валюта] [@счёт] [категория] [описание]
/income <сумма> ...
/accounts — счета
...
"""
```

```python
# telegram_runtime.py
async def register_webhook() -> None:
    if should_use_polling():
        logger.info("Telegram polling mode — skipping setWebhook")
        return
    # setWebhook → {API_PUBLIC_URL}/notification/api/telegram/webhook
```

Модули: [[Уведомления]], [[Telegram]].

## См. также

[[Деплой]] · [[Конфигурация]] · [[Finance Service]]
