import logging
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app import finance_client
from app.models import TelegramLink, TelegramLinkToken

logger = logging.getLogger(__name__)

TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "").lstrip("@")
LINK_TOKEN_TTL_MINUTES = 15


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_link_token() -> str:
    # Telegram start payload: [A-Za-z0-9_-], max 64 chars. Hex is safest.
    return secrets.token_hex(16)


def mask_chat_id(chat_id: int) -> str:
    s = str(chat_id)
    if len(s) <= 4:
        return "****"
    return f"{s[:2]}…{s[-2:]}"


async def get_link_by_user(db: AsyncSession, user_id: str) -> TelegramLink | None:
    result = await db.execute(select(TelegramLink).where(TelegramLink.user_id == user_id))
    return result.scalar_one_or_none()


async def get_link_by_chat(db: AsyncSession, chat_id: int) -> TelegramLink | None:
    result = await db.execute(select(TelegramLink).where(TelegramLink.chat_id == chat_id))
    return result.scalar_one_or_none()


async def create_link_token(db: AsyncSession, user_id: str) -> TelegramLinkToken:
    await db.execute(delete(TelegramLinkToken).where(TelegramLinkToken.user_id == user_id))
    token = TelegramLinkToken(
        user_id=user_id,
        token=generate_link_token(),
        expires_at=_utcnow() + timedelta(minutes=LINK_TOKEN_TTL_MINUTES),
    )
    db.add(token)
    await db.commit()
    await db.refresh(token)
    return token


def build_deep_link(token: str) -> str:
    if TELEGRAM_BOT_USERNAME:
        return f"https://t.me/{TELEGRAM_BOT_USERNAME}?start={token}"
    return f"tg://resolve?domain=BOT&start={token}"


async def consume_link_token(
    db: AsyncSession, token: str, chat_id: int
) -> tuple[bool, str]:
    token = (token or "").strip()
    result = await db.execute(
        select(TelegramLinkToken).where(TelegramLinkToken.token == token)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return (
            False,
            "Код не найден. В Настройках нажмите «Привязать» ещё раз "
            "и сразу откройте новую ссылку (старая после повторного нажатия не работает).",
        )
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < _utcnow():
        await db.delete(row)
        await db.commit()
        return False, "Срок действия кода истёк. Создайте новый в Настройках."

    existing_chat = await get_link_by_chat(db, chat_id)
    if existing_chat and existing_chat.user_id != row.user_id:
        return False, "Этот Telegram уже привязан к другому аккаунту."

    existing_user = await get_link_by_user(db, row.user_id)
    if existing_user:
        existing_user.chat_id = chat_id
        existing_user.updated_at = _utcnow()
    else:
        db.add(TelegramLink(user_id=row.user_id, chat_id=chat_id))

    await db.delete(row)
    await db.commit()
    return True, "Telegram успешно привязан. Используйте /help для списка команд."


async def unlink_chat(db: AsyncSession, chat_id: int) -> str:
    link = await get_link_by_chat(db, chat_id)
    if link is None:
        return "Telegram не привязан."
    await db.delete(link)
    await db.commit()
    return "Привязка снята."


async def unlink_user(db: AsyncSession, user_id: str) -> bool:
    link = await get_link_by_user(db, user_id)
    if link is None:
        return False
    await db.delete(link)
    await db.commit()
    return True


def parse_amount(raw: str) -> Decimal | None:
    try:
        return Decimal(raw.replace(",", ".").strip())
    except (InvalidOperation, AttributeError):
        return None


def _is_currency_token(token: str) -> bool:
    # ISO-4217-like codes only (ASCII), so Cyrillic categories like «Еда» are safe.
    return bool(token) and len(token) == 3 and token.isascii() and token.isalpha()


def _parse_account_token(token: str) -> str | None:
    """@Cash / счет:Cash / счёт:Cash / account:Cash → account name."""
    raw = token.strip()
    lower = raw.casefold()
    for prefix in ("счет:", "счёт:", "account:", "acc:"):
        if lower.startswith(prefix):
            name = raw[len(prefix) :].strip()
            return name.replace("_", " ") if name else None
    if raw.startswith("@") and len(raw) > 1:
        return raw[1:].replace("_", " ")
    return None


def parse_tx_args(
    parts: list[str],
) -> tuple[Decimal | None, str | None, str | None, str | None, str | None]:
    """Parse: amount [currency] [@account|счет:Name] [category] [description...]

    Returns: amount, currency, account_name, category, description
    """
    if not parts:
        return None, None, None, None, None
    amount = parse_amount(parts[0])
    if amount is None or amount <= 0:
        return None, None, None, None, None

    currency: str | None = None
    account_name: str | None = None
    rest: list[str] = []

    for token in parts[1:]:
        acc = _parse_account_token(token)
        if acc is not None and account_name is None:
            account_name = acc
            continue
        if currency is None and _is_currency_token(token):
            currency = token.upper()
            continue
        rest.append(token)

    if not rest:
        return amount, currency, account_name, None, None
    if len(rest) == 1:
        return amount, currency, account_name, rest[0], None
    return amount, currency, account_name, rest[0], " ".join(rest[1:])


def resolve_account(
    accounts: list[dict[str, Any]],
    *,
    preferred_account_id: int | None = None,
    account_name: str | None = None,
    currency: str | None = None,
) -> tuple[int | None, str]:
    if not accounts:
        return None, "Нет счетов. Создайте счёт в приложении."

    currency_u = currency.upper() if currency else None
    pool = accounts
    if currency_u:
        pool = [
            a
            for a in accounts
            if str(a.get("currency", "")).upper() == currency_u
        ]
        if not pool:
            known = sorted({str(a.get("currency", "")).upper() for a in accounts})
            return (
                None,
                f"Нет счёта в валюте {currency_u}. Доступно: {', '.join(known) or '—'}",
            )

    if account_name:
        needle = account_name.casefold()
        named = [a for a in pool if str(a.get("name", "")).casefold() == needle]
        if not named:
            # try among all accounts to give a better error
            any_named = [
                a for a in accounts if str(a.get("name", "")).casefold() == needle
            ]
            if any_named and currency_u:
                got = str(any_named[0].get("currency", "")).upper()
                return (
                    None,
                    f"Счёт «{account_name}» в валюте {got}, а указано {currency_u}.",
                )
            names = ", ".join(str(a.get("name", "")) for a in pool)
            return None, f"Счёт «{account_name}» не найден. Доступно: {names or '—'}"
        return named[0].get("id"), ""

    if preferred_account_id is not None:
        for acc in pool:
            if acc.get("id") == preferred_account_id:
                return preferred_account_id, ""

    return pool[0].get("id"), ""


def match_category(
    categories: list[dict[str, Any]],
    name: str | None,
    tx_type: str,
) -> tuple[int | None, str | None]:
    """Returns (category_id, leftover_description_if_no_match)."""
    if not name:
        return None, None
    needle = name.strip().casefold()
    for cat in categories:
        cat_type = str(cat.get("type", "")).lower()
        if cat_type != tx_type.lower():
            continue
        if str(cat.get("name", "")).casefold() == needle:
            return cat.get("id"), None
    return None, name


async def create_user_transaction(
    db: AsyncSession,
    user_id: str,
    tx_type: str,
    amount: Decimal,
    category_name: str | None = None,
    description: str | None = None,
    account_id: int | None = None,
    account_name: str | None = None,
    currency: str | None = None,
) -> tuple[dict[str, Any] | None, str]:
    try:
        uid = int(user_id)
    except ValueError:
        return None, "Некорректный пользователь."

    link = await get_link_by_user(db, user_id)
    preferred = account_id
    if preferred is None and link is not None:
        preferred = link.default_account_id

    try:
        accounts = await finance_client.list_accounts(uid)
        categories = await finance_client.list_categories(uid)
    except finance_client.FinanceClientError as exc:
        return None, f"Ошибка finance-service: {exc}"

    resolved_account, acc_err = resolve_account(
        accounts,
        preferred_account_id=preferred,
        account_name=account_name,
        currency=currency,
    )
    if acc_err or resolved_account is None:
        return None, acc_err or "Не удалось выбрать счёт."

    cat_id, leftover = match_category(categories, category_name, tx_type)
    final_description = description
    if leftover and not final_description:
        final_description = leftover
    elif leftover and final_description:
        final_description = f"{leftover} {final_description}".strip()

    payload = {
        "user_id": uid,
        "account_id": resolved_account,
        "category_id": cat_id,
        "amount": str(amount),
        "description": final_description,
        "transaction_type": tx_type,
        "date": date.today().isoformat(),
        "is_recurring": False,
    }
    try:
        txn = await finance_client.create_transaction(payload)
    except finance_client.FinanceClientError as exc:
        return None, f"Не удалось создать транзакцию: {exc}"
    return txn, ""


def format_tx_ok(txn: dict[str, Any]) -> str:
    amount = txn.get("amount")
    currency = txn.get("account_currency") or ""
    acc = txn.get("account_name") or ""
    cat = txn.get("category_name")
    desc = txn.get("description")
    tx_type = str(txn.get("transaction_type", "")).lower()
    label = "Расход" if tx_type == "expense" else "Доход"
    lines = [f"✅ {label}: {amount} {currency}".strip()]
    if acc:
        lines.append(f"Счёт: {acc}")
    if cat:
        lines.append(f"Категория: {cat}")
    if desc:
        lines.append(f"Описание: {desc}")
    return "\n".join(lines)


HELP_TEXT = """Команды:
/expense <сумма> [валюта] [@счёт] [категория] [описание]
/income <сумма> [валюта] [@счёт] [категория] [описание]
/accounts — счета
/categories — категории
/balance — балансы
/app — открыть мини-приложение (счета и операции)
/unlink — отвязать Telegram
/help — справка

Валюта: RUB USD EUR …
Счёт: @Cash или счет:Наличные (пробел → _)

Примеры:
/expense 350 Еда кофе
/expense 350 RUB Еда кофе
/expense 20 USD @Dollar Еда lunch
/income 50000 RUB счет:Зарплатная Зарплата

С iPhone: Shortcuts собирает команду из переменных
и отправляет сообщением этому боту.
"""


async def handle_bot_command(db: AsyncSession, chat_id: int, text: str) -> str:
    text = (text or "").strip()
    if not text:
        return HELP_TEXT

    if text.startswith("/"):
        # drop @botname suffix
        first, *rest_parts = text.split(maxsplit=1)
        cmd = first.split("@", 1)[0].lower()
        args = rest_parts[0].split() if rest_parts else []
    else:
        return "Неизвестная команда. /help"

    if cmd == "/start":
        if not args:
            link = await get_link_by_chat(db, chat_id)
            if link:
                return "Уже привязано. /help"
            return (
                "Чтобы привязать аккаунт, создайте код в Настройках → Telegram "
                "и откройте ссылку или отправьте /start <код>."
            )
        ok, msg = await consume_link_token(db, args[0], chat_id)
        logger.info(
            "telegram /start link chat_id=%s token=%r ok=%s",
            chat_id,
            args[0],
            ok,
        )
        return msg

    if cmd == "/help":
        return HELP_TEXT

    if cmd == "/unlink":
        return await unlink_chat(db, chat_id)

    link = await get_link_by_chat(db, chat_id)
    if link is None:
        return "Сначала привяжите Telegram в Настройках приложения."

    user_id = link.user_id
    uid = int(user_id)

    if cmd == "/accounts":
        try:
            accounts = await finance_client.list_accounts(uid)
        except finance_client.FinanceClientError as exc:
            return f"Ошибка: {exc}"
        if not accounts:
            return "Счетов нет."
        lines = ["Счета:"]
        for a in accounts:
            mark = " ★" if link.default_account_id == a.get("id") else ""
            lines.append(
                f"• {a.get('name')} — {a.get('balance')} {a.get('currency')}{mark}"
            )
        return "\n".join(lines)

    if cmd == "/categories":
        try:
            categories = await finance_client.list_categories(uid)
        except finance_client.FinanceClientError as exc:
            return f"Ошибка: {exc}"
        if not categories:
            return "Категорий нет."
        income = [c for c in categories if str(c.get("type", "")).lower() == "income"]
        expense = [c for c in categories if str(c.get("type", "")).lower() == "expense"]
        lines = ["Категории:"]
        if expense:
            lines.append("Расходы: " + ", ".join(c.get("name", "") for c in expense))
        if income:
            lines.append("Доходы: " + ", ".join(c.get("name", "") for c in income))
        return "\n".join(lines)

    if cmd == "/balance":
        try:
            accounts = await finance_client.list_accounts(uid)
        except finance_client.FinanceClientError as exc:
            return f"Ошибка: {exc}"
        if not accounts:
            return "Счетов нет."
        lines = ["Балансы:"]
        for a in accounts:
            lines.append(f"• {a.get('name')}: {a.get('balance')} {a.get('currency')}")
        return "\n".join(lines)

    if cmd in ("/expense", "/income"):
        tx_type = "expense" if cmd == "/expense" else "income"
        amount, currency, account_name, cat, desc = parse_tx_args(args)
        if amount is None:
            return (
                f"Использование: {cmd} <сумма> [валюта] [@счёт] [категория] [описание]\n"
                f"Пример: {cmd} 350 RUB @Cash Еда кофе"
            )
        txn, err = await create_user_transaction(
            db,
            user_id,
            tx_type,
            amount,
            cat,
            desc,
            None,
            account_name=account_name,
            currency=currency,
        )
        if err:
            return err
        return format_tx_ok(txn or {})

    return "Неизвестная команда. /help"
