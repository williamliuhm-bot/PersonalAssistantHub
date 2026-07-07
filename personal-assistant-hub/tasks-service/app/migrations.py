from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

MIGRATION_SQL = """
ALTER TABLE habits ADD COLUMN IF NOT EXISTS times_per_day INTEGER NOT NULL DEFAULT 1;
"""


async def run_migrations(conn: AsyncConnection) -> None:
    for statement in MIGRATION_SQL.strip().split(";"):
        stmt = statement.strip()
        if stmt:
            await conn.execute(text(stmt))
