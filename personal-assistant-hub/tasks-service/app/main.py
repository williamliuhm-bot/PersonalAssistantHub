from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import jwt

from app.database import engine
from app.models import Base
from app.migrations import run_migrations
from app.routes import projects, tasks, habits

app = FastAPI(title="Tasks Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await run_migrations(conn)


@app.exception_handler(jwt.ExpiredSignatureError)
async def expired_token_handler(request: Request, exc: jwt.ExpiredSignatureError):
    return JSONResponse(status_code=401, content={"detail": "Token expired"})


@app.exception_handler(jwt.InvalidTokenError)
async def invalid_token_handler(request: Request, exc: jwt.InvalidTokenError):
    return JSONResponse(status_code=401, content={"detail": "Invalid token"})


@app.get("/health")
async def health():
    return {"status": "ok", "service": "tasks-service"}


app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(habits.router)
