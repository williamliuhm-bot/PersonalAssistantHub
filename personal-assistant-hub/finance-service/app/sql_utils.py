from sqlalchemy import String, cast
from sqlalchemy.sql import func


def year_month_expr(date_column):
    """YYYY-MM label from a date column (PostgreSQL, SQLite, etc.)."""
    return func.substr(cast(date_column, String), 1, 7)
