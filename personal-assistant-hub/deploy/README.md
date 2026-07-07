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

## Локальный деплой по SSH

```bash
# с машины, где есть SSH-ключ к root@193.187.96.75
scp -r personal-assistant-hub root@193.187.96.75:/opt/personal-assistant-hub
ssh root@193.187.96.75 'cd /opt/personal-assistant-hub && cp deploy/env.production .env && ./deploy/deploy.sh'
```
