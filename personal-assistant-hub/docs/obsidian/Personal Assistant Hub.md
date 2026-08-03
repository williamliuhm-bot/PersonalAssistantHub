---
tags:
  - pah
  - moc
  - index
aliases:
  - PAH
  - PersonalAssistantHub
  - Карта проекта
---

# Personal Assistant Hub

> Интеллектуальная система управления финансами и временем.
> Десктоп (Electron) + веб + Telegram Mini App: финансы, задачи, привычки, аналитика.

![[assets/ui-dashboard.png]]

## Карта заметок (MOC)

### Обзор
- [[Архитектура]]
- [[Стек технологий]]
- [[Доменная модель]]
- [[Быстрый старт]]
- [[Скриншоты UI]]

### Сервисы
- [[API Gateway]]
- [[Auth Service]]
- [[Finance Service]]
- [[Tasks Service]]
- [[Notification Service]]
- [[Integration Service]]
- [[Frontend]]

### Модули продукта
- [[Финансы]]
- [[Задачи и проекты]]
- [[Привычки]]
- [[Календарь]]
- [[Аналитика]]
- [[Уведомления]]
- [[Telegram]]
- [[Авторизация и админка]]
- [[Настройки]]

### Инфраструктура
- [[Деплой]]
- [[Конфигурация]]

## Корень репозитория

```
PersonalAssistantHub/
└── personal-assistant-hub/   ← основное приложение
    ├── api-gateway/
    ├── auth-service/
    ├── finance-service/
    ├── tasks-service/
    ├── notification-service/
    ├── integration-service/
    ├── frontend/
    ├── shared/
    ├── scripts/
    ├── tests/
    └── deploy/
```

## Порты (dev)

| Что | Порт |
|-----|------|
| Frontend (nginx / Vite) | 3000 / 5173 |
| API Gateway | 8000 |
| Auth | 8001 |
| Finance | 8002 |
| Tasks | 8003 |
| Notification | 8004 |
| Integration | 8005 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Демо-доступ

После `seed_data.py`:
- **Email:** `demo@example.com`
- **Password:** `password123`

## Связанные исходники

- `README.md` — краткий обзор
- `deploy/README.md` — прод-деплой и Telegram
- `docker-compose.yml` — локальный стек
