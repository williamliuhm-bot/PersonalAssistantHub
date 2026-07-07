#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Create .env from deploy/env.production: cp deploy/env.production .env"
  exit 1
fi

echo "==> Build / start (production)"
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build

echo "==> Seed demo data (optional, first run)"
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml run --rm \
  -v "${ROOT}/scripts:/scripts" integration-service python /scripts/seed_data.py || true

echo "==> Status"
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps

echo ""
echo "Done:"
echo "  App: https://${DOMAIN:-221011.com}"
echo "  API: https://${API_DOMAIN:-api.221011.com}/docs"
