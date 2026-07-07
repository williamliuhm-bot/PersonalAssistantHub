from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

MIGRATION_SQL = """
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
"""


async def run_migrations(conn: AsyncConnection) -> None:
    for statement in MIGRATION_SQL.strip().split(";"):
        stmt = statement.strip()
        if stmt:
            await conn.execute(text(stmt))
