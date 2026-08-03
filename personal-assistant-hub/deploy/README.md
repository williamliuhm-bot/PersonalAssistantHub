# Деплой на сервер

## Требования

- Ubuntu/Debian, Docker + Docker Compose
- DNS: `221011.com` и `api.221011.com` → IP сервера
- Порты 80, 443 открыты

## Первый запуск на сервере

```bash
# 1. Установка Docker (если нет)
curl -fsSL https://get.docker.com | sh

# 2. Клонирование
git clone https://github.com/Magicenda/PersonalAssistantHub.git
cd PersonalAssistantHub/personal-assistant-hub

# 3. Конфиг
cp deploy/env.production .env
# при необходимости отредактируй .env

# 4. Запуск
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

## Автозапуск после перезагрузки сервера

1. У всех контейнеров `restart: always` (включая postgres и redis).
2. Systemd-юнит `/etc/systemd/system/personal-assistant-hub.service` поднимает стек после Docker:
   ```bash
   systemctl enable personal-assistant-hub.service
   systemctl enable docker
   ```
3. Swap `/swapfile` (2G) прописан в `/etc/fstab`.

## Telegram-бот (доходы/расходы)

В `.env` задайте:

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`
- `API_PUBLIC_URL=https://api.<ваш-домен>` (публичный URL gateway)
- `INTERNAL_SERVICE_TOKEN` (общий секрет finance ↔ notification)

После старта notification-service сам вызовет `setWebhook` на  
`{API_PUBLIC_URL}/notification/api/telegram/webhook`.

Привязка аккаунта: Настройки → Telegram → «Привязать».

iOS Shortcuts: соберите команду (`/expense 350 RUB @Cash Еда кофе`) из переменных и отправьте
сообщением в чат с ботом (действие «Отправить сообщение» в Telegram), не HTTP POST на API.

## Telegram Mini App

В `.env`:
- `TELEGRAM_WEBAPP_URL=https://<DOMAIN>` — фронт по HTTPS (откроется `/tg`)

После старта бот ставит кнопку меню «Финансы». Также команда `/app`.
Пользователь должен быть привязан (Настройки → Telegram).


```bash
# с машины, где есть SSH-ключ к root@193.187.96.75
scp -r personal-assistant-hub root@193.187.96.75:/opt/personal-assistant-hub
ssh root@193.187.96.75 'cd /opt/personal-assistant-hub && cp deploy/env.production .env && ./deploy/deploy.sh'
```
