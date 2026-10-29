"""Dormant backend boundary for Blueprint QA; no routes or database writes.

The decoder must be the server's cryptographic access-token verifier, never a
client callback or an unverified JWT parser. The authority provider must resolve
current blacklist/account/session/membership state and the integer-to-UUID
mapping from server-owned storage on every operation. Those storage bindings do
not exist in this repository yet: enabling the flag alone cannot authorize work.

A returned identity is data, not a reusable approval receipt. A future publisher
must check authority and consume its receipt inside the same DB transaction.
This module does not implement that transaction or modify the Login flow.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import math
import os
from typing import Protocol
from uuid import UUID


class BlueprintIdentityDenied(RuntimeError):
    """Stable reason code only; never include tokens or provider exceptions."""


@dataclass(frozen=True)
class CurrentAuthority:
    token_fingerprint: str
    auth_user_id: int
    tenant_id: UUID
    receipt_user_id: UUID
    session_id: UUID
    generation: int
    role: str
    checked_at: datetime
    session_expires_at: datetime
    user_active: bool
    session_active: bool
    membership_active: bool
    token_revoked: bool


@dataclass(frozen=True)
class BlueprintIdentity:
    auth_user_id: int
    tenant_id: UUID
    receipt_user_id: UUID
    session_id: UUID
    generation: int
    scope: str
    verified_at: datetime
    valid_until: datetime


class AuthorityProvider(Protocol):
    async def resolve_access_token(self, fingerprint: str) -> CurrentAuthority | None:
        """Read fresh server state, failing if revocation cannot be checked."""
        ...


def _aware(value: object) -> bool:
    return isinstance(value, datetime) and value.utcoffset() is not None


def _epoch(value: object) -> bool:
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except (OverflowError, ValueError):
        return False


class BlueprintIdentityBoundary:
    """Server-composed dependencies only; feature state is never request input."""

    MAX_AUTHORITY_AGE = timedelta(seconds=5)

    def __init__(
        self,
        verified_access_token_decoder: Callable[[str], Mapping | None] | None = None,
        authority: AuthorityProvider | None = None,
        *,
        enabled: bool = False,
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ):
        self._decoder = verified_access_token_decoder
        self._authority = authority
        self._enabled = enabled is True
        self._clock = clock

    @classmethod
    def from_environment(cls, verified_access_token_decoder=None, authority=None):
        # No signing-key fallback, connection string, cache, or service discovery.
        return cls(
            verified_access_token_decoder,
            authority,
            enabled=os.getenv('BLUEPRINT_B2B3_IDENTITY_ENABLED', '0') == '1',
        )

    async def authorize(
        self,
        access_token: str,
        *,
        tenant_id: UUID,
        expected_generation: int,
        scope: str,
    ) -> BlueprintIdentity:
        if not self._enabled:
            raise BlueprintIdentityDenied('feature_disabled')
        if self._decoder is None or self._authority is None:
            raise BlueprintIdentityDenied('backend_identity_unavailable')
        if (not isinstance(access_token, str) or not 1 <= len(access_token) <= 8192
                or not access_token.isascii() or any(c.isspace() for c in access_token)):
            raise BlueprintIdentityDenied('invalid_access_token')
        if (not isinstance(tenant_id, UUID) or type(expected_generation) is not int
                or expected_generation < 1 or scope not in ('NORMAL', 'CRITICAL')):
            raise BlueprintIdentityDenied('invalid_target')
        now = self._clock()
        if not _aware(now):
            raise BlueprintIdentityDenied('invalid_server_clock')
        try:
            claims = self._decoder(access_token)
        except Exception:
            raise BlueprintIdentityDenied('token_verification_failed') from None
        if not isinstance(claims, Mapping) or claims.get('type') != 'access':
            raise BlueprintIdentityDenied('invalid_access_claims')
        subject = claims.get('sub')
        if (not isinstance(subject, str) or not subject.isascii()
                or not subject.isdecimal() or not 1 <= len(subject) <= 19
                or subject.startswith('0')):
            raise BlueprintIdentityDenied('invalid_access_claims')
        issued, expires = claims.get('iat'), claims.get('exp')
        if (not _epoch(issued) or not _epoch(expires) or issued > now.timestamp()
                or expires <= now.timestamp() or issued >= expires):
            raise BlueprintIdentityDenied('expired_or_invalid_access_token')
        try:
            token_expiry = datetime.fromtimestamp(expires, timezone.utc)
        except (OverflowError, ValueError, OSError):
            raise BlueprintIdentityDenied('expired_or_invalid_access_token') from None
        fingerprint = hashlib.sha256(access_token.encode('ascii')).hexdigest()
        try:
            current = await self._authority.resolve_access_token(fingerprint)
        except Exception:
            raise BlueprintIdentityDenied('authority_unavailable') from None
        # Re-read the clock after awaited IO; expiry cannot use request-start time.
        checked_now = self._clock()
        if not _aware(checked_now) or checked_now < now or checked_now >= token_expiry:
            raise BlueprintIdentityDenied('expired_or_invalid_access_token')
        if not isinstance(current, CurrentAuthority):
            raise BlueprintIdentityDenied('backend_identity_unavailable')
        if (not isinstance(current.token_fingerprint, str)
                or not current.token_fingerprint.isascii()
                or len(current.token_fingerprint) != 64
                or not hmac.compare_digest(current.token_fingerprint, fingerprint)
                or type(current.auth_user_id) is not int
                or current.auth_user_id != int(subject)
                or not all(isinstance(v, UUID) and v.int != 0 for v in
                           (current.tenant_id, current.receipt_user_id, current.session_id))):
            raise BlueprintIdentityDenied('identity_binding_failed')
        if current.tenant_id != tenant_id:
            raise BlueprintIdentityDenied('tenant_denied')
        if (type(current.generation) is not int
                or current.generation != expected_generation):
            raise BlueprintIdentityDenied('stale_generation')
        if (current.user_active is not True or current.session_active is not True
                or current.membership_active is not True or current.token_revoked is not False):
            raise BlueprintIdentityDenied('revoked_identity')
        if (not _aware(current.checked_at) or current.checked_at > checked_now
                or checked_now - current.checked_at >= self.MAX_AUTHORITY_AGE
                or not _aware(current.session_expires_at)
                or current.session_expires_at <= checked_now):
            raise BlueprintIdentityDenied('stale_or_expired_authority')
        if (current.role not in ('approver', 'admin')
                or scope == 'CRITICAL' and current.role != 'admin'):
            raise BlueprintIdentityDenied('role_denied')
        # Claims for role, tenant, receipt-user or session are intentionally ignored.
        return BlueprintIdentity(
            current.auth_user_id, current.tenant_id, current.receipt_user_id,
            current.session_id, current.generation, scope, checked_now,
            min(token_expiry, current.session_expires_at,
                current.checked_at + self.MAX_AUTHORITY_AGE),
        )
