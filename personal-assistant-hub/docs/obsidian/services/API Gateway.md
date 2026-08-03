---
tags:
  - pah
  - service
---

# API Gateway

**Порт:** 8000 · папка `api-gateway/`

Единая точка входа: JWT, CORS, rate limit (~100/min), proxy.

## Маршруты

```python
@app.api_route("/auth/{path:path}", methods=[...])
async def auth_proxy(...):
    return await _proxy(SERVICE_URLS["auth"], request)

@app.api_route("/finance/{path:path}", methods=[...])
async def finance_proxy(...):
    return await _proxy_rewrite(SERVICE_URLS["finance"], request, "/finance")

# аналогично: /tasks, /notification, /integration
```

## Health (агрегат upstream)

```python
@app.get("/health")
async def health(request: Request):
    upstream_status = {}
    for name, url in SERVICE_URLS.items():
        r = await client.get(f"{url}/health")
        upstream_status[name] = "up" if r.is_success else "degraded"
    return {"status": "ok", "services": upstream_status}
```

## См. также

[[Архитектура]] · [[Авторизация и админка]] · [[Конфигурация]]
