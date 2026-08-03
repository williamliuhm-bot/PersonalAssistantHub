import os
import time
import logging
from contextlib import asynccontextmanager

import jwt
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api-gateway")

SERVICE_URLS = {
    "auth": os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001"),
    "finance": os.getenv("FINANCE_SERVICE_URL", "http://finance-service:8002"),
    "tasks": os.getenv("TASKS_SERVICE_URL", "http://tasks-service:8003"),
    "notification": os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8004"),
    "integration": os.getenv("INTEGRATION_SERVICE_URL", "http://integration-service:8005"),
}

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key")
JWT_ALGORITHM = "HS256"

PROTECTED_PREFIXES = ("/auth", "/docs", "/openapi.json", "/redoc", "/health")

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("API Gateway starting up")
    for name, url in SERVICE_URLS.items():
        logger.info(f"  {name}-service  ->  {url}")
    yield
    logger.info("API Gateway shutting down")


app = FastAPI(
    title="Personal Assistant Hub API Gateway",
    description="Single entry point for all microservices",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} "
            f"({elapsed:.3f}s)"
        )
        return response


app.add_middleware(RequestLoggingMiddleware)


def _is_protected(path: str) -> bool:
    if path.startswith("/health"):
        return False
    if path.startswith("/auth"):
        return False
    if path.startswith("/docs"):
        return False
    if path.startswith("/openapi.json"):
        return False
    if path.startswith("/redoc"):
        return False
    if path == "/notification/api/telegram/webhook":
        return False
    if path == "/notification/api/telegram/webapp/auth":
        return False
    return True


class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        if _is_protected(request.url.path):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing or invalid Authorization header"},
                )
            token = auth_header.removeprefix("Bearer ")
            try:
                payload = jwt.decode(
                    token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
                )
                request.state.user = payload
            except jwt.ExpiredSignatureError:
                return JSONResponse(
                    status_code=401, content={"detail": "Token has expired"}
                )
            except jwt.InvalidTokenError:
                return JSONResponse(
                    status_code=401, content={"detail": "Invalid token"}
                )
        return await call_next(request)


app.add_middleware(JWTAuthMiddleware)


async def _proxy(service_base: str, request: Request) -> Response:
    path = request.url.path
    query = request.url.query
    target_url = f"{service_base}{path}"
    if query:
        target_url = f"{target_url}?{query}"

    headers_to_forward = {
        k: v for k, v in request.headers.items() if k.lower() != "host"
    }

    body = await request.body()

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers_to_forward,
                content=body if body else None,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
        except httpx.RequestError as e:
            logger.error(f"Proxy error to {target_url}: {e}")
            return JSONResponse(
                status_code=502,
                content={"detail": f"Bad gateway: cannot reach upstream service"},
            )


async def _proxy_rewrite(service_base: str, request: Request, strip_prefix: str) -> Response:
    full_path = request.url.path
    if full_path.startswith(strip_prefix):
        path = full_path[len(strip_prefix):]
    else:
        path = full_path
    query = request.url.query
    target_url = f"{service_base}{path}"
    if query:
        target_url = f"{target_url}?{query}"

    headers_to_forward = {
        k: v for k, v in request.headers.items() if k.lower() != "host"
    }

    body = await request.body()

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers_to_forward,
                content=body if body else None,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
        except httpx.RequestError as e:
            logger.error(f"Proxy error to {target_url}: {e}")
            return JSONResponse(
                status_code=502,
                content={"detail": f"Bad gateway: cannot reach upstream service"},
            )


@app.get("/health")
@limiter.limit("100/minute")
async def health(request: Request):
    upstream_status = {}
    for name, url in SERVICE_URLS.items():
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{url}/health")
                upstream_status[name] = "up" if r.is_success else "degraded"
        except Exception:
            upstream_status[name] = "down"
    return {"status": "ok", "services": upstream_status}


@app.api_route(
    "/auth/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
)
@limiter.limit("100/minute")
async def auth_proxy(request: Request, path: str):
    return await _proxy(SERVICE_URLS["auth"], request)


@app.api_route(
    "/finance/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
)
@limiter.limit("100/minute")
async def finance_proxy(request: Request, path: str):
    return await _proxy_rewrite(SERVICE_URLS["finance"], request, "/finance")


@app.api_route(
    "/tasks/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
)
@limiter.limit("100/minute")
async def tasks_proxy(request: Request, path: str):
    return await _proxy_rewrite(SERVICE_URLS["tasks"], request, "/tasks")


@app.api_route(
    "/notification/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
)
@limiter.limit("100/minute")
async def notification_proxy(request: Request, path: str):
    return await _proxy_rewrite(SERVICE_URLS["notification"], request, "/notification")


@app.api_route(
    "/integration/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
)
@limiter.limit("100/minute")
async def integration_proxy(request: Request, path: str):
    return await _proxy_rewrite(SERVICE_URLS["integration"], request, "/integration")
