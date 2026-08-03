---
tags:
  - pah
  - service
---

# Integration Service

**Порт:** 8005 · папка `integration-service/`

![[assets/ui-analytics.png]]

## Events + Celery

```python
@app.post("/api/events")
async def receive_event(event: EventPayload, request: Request):
    if event.event_type == "recurring_payment_created":
        auto_create_task_from_payment.delay(event.model_dump())
```

```python
# celery_beat.py
"analyze-productivity-daily": crontab(hour=23, minute=0),
"forecast-budget-daily": crontab(hour=6, minute=0),
```

Аналитика: scipy/numpy корреляции, budget forecasts, i18n insights.

Модуль: [[Аналитика]].

## См. также

[[Архитектура]] · [[Финансы]] · [[Задачи и проекты]]
