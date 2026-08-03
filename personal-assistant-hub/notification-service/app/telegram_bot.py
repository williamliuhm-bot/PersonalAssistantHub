"""Shared Bot factory with optional HTTP/SOCKS proxy for blocked networks."""
from __future__ import annotations

import logging
import os

from telegram import Bot
from telegram.request import HTTPXRequest

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
# Example: socks5://host.docker.internal:1080  or  http://host.docker.internal:7890
TELEGRAM_PROXY_URL = os.getenv("TELEGRAM_PROXY_URL", "").strip()


def create_bot(token: str | None = None) -> Bot:
    tok = token or TELEGRAM_BOT_TOKEN
    if not tok:
        raise ValueError("TELEGRAM_BOT_TOKEN is empty")

    proxy = TELEGRAM_PROXY_URL or None
    if proxy:
        logger.info("Telegram Bot API via proxy: %s", _mask_proxy(proxy))
        request = HTTPXRequest(
            proxy=proxy,
            connect_timeout=20.0,
            read_timeout=30.0,
            write_timeout=30.0,
            pool_timeout=5.0,
        )
        return Bot(token=tok, request=request)

    return Bot(token=tok)


def _mask_proxy(url: str) -> str:
    if "@" in url:
        scheme, rest = url.split("://", 1) if "://" in url else ("", url)
        creds, host = rest.rsplit("@", 1)
        return f"{scheme}://***@{host}" if scheme else f"***@{host}"
    return url
