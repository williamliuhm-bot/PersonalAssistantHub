import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import JWT_ALGORITHM, JWT_SECRET_KEY as JWT_SECRET
from app.database import Base, engine
from app.routes.analytics import router as analytics_router
from app.schemas import EventPayload

import jwt

app = FastAPI(title="Integration Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    if request.url.path in (
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/events",
    ):
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401, content={"detail": "Missing or invalid Authorization header"}
        )
    token = auth_header.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        request.state.user_id = payload.get("sub")
        if request.state.user_id is None:
            return JSONResponse(
                status_code=401, content={"detail": "Token missing user_id"}
            )
    except jwt.ExpiredSignatureError:
        return JSONResponse(status_code=401, content={"detail": "Token expired"})
    except jwt.InvalidTokenError:
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    return await call_next(request)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "integration-service", "port": 8005}


@app.post("/api/events")
async def receive_event(event: EventPayload, request: Request):
    from app.tasks import auto_create_task_from_payment

    if event.event_type == "recurring_payment_created":
        auto_create_task_from_payment.delay(event.model_dump())

    return {"status": "received", "event_type": event.event_type}


app.include_router(analytics_router)
