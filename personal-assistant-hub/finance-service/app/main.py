from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.auth import get_current_user_id
from app.routes import accounts, categories, transactions, budgets, reports, internal

app = FastAPI(title="Finance Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "finance-service"}


app.include_router(accounts.router, prefix="/api", dependencies=[Depends(get_current_user_id)])
app.include_router(categories.router, prefix="/api", dependencies=[Depends(get_current_user_id)])
app.include_router(transactions.router, prefix="/api", dependencies=[Depends(get_current_user_id)])
app.include_router(budgets.router, prefix="/api", dependencies=[Depends(get_current_user_id)])
app.include_router(reports.router, prefix="/api", dependencies=[Depends(get_current_user_id)])
app.include_router(internal.router, prefix="/api")
