"""Proposed QA-only intent binding; no auth, receipts, DB writes or routes.

EXACT means content/metadata equality only. It never authorizes publication or
proves a commit. Existing Receipt SQL content_sha256 semantics are unchanged.
All UUIDs/decision references in real use would require server-owned resolution.
"""
from dataclasses import dataclass, field
from decimal import Decimal, DecimalException
from enum import Enum
import hashlib
import json
import re
from uuid import UUID


DOMAIN = 'blueprint-publication-intent/1-draft'
MAX_SPEC_BYTES = 1_048_576  # QA parser bound, not a deployed application setting.
MAX_DEPTH = 64
MAX_I64 = 2**63 - 1
KINDS = ('DRAFT', 'APPROVED_DESIGN', 'IMPLEMENTED_RELEASE')


class PublicationContractError(ValueError):
    """Stable diagnostic codes only, without snapshot or identity contents."""


@dataclass(frozen=True)
class PublicationIntent:
    tenant_id: UUID
    operation_id: UUID
    receipt_user_id: UUID
    session_id: UUID
    generation: int
    scope: str
    module_id: str
    version_kind: str
    expected_revision: int
    spec_json: bytes = field(repr=False)
    parent_version_id: UUID | None = None
    decision_ref: str | None = None
    code_commit_sha: str | None = None


@dataclass(frozen=True)
class StoredPublicationResult:
    tenant_id: UUID
    operation_id: UUID
    intent_sha256: str
    version_id: UUID


class RecoveryMatch(str, Enum):
    UNKNOWN = 'UNKNOWN'
    EXACT = 'EXACT'
    CONFLICT = 'CONFLICT'


def _uuid(value):
    return isinstance(value, UUID) and value.int != 0


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise PublicationContractError('invalid_spec_json')
        result[key] = value
    return result


def _walk(value, depth=0):
    if depth > MAX_DEPTH:
        raise PublicationContractError('invalid_spec_json')
    if isinstance(value, str):
        value.encode('utf-8', errors='strict')
    elif isinstance(value, dict):
        for key, child in value.items():
            key.encode('utf-8', errors='strict')
            _walk(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            _walk(child, depth + 1)
    elif isinstance(value, Decimal) and not value.is_finite():
        raise PublicationContractError('invalid_spec_json')


def _invalid_constant(_):
    raise PublicationContractError('invalid_spec_json')


def _spec_hash(raw):
    if type(raw) is not bytes or not 1 <= len(raw) <= MAX_SPEC_BYTES:
        raise PublicationContractError('invalid_spec_json')
    try:
        parsed = json.loads(raw.decode('utf-8', errors='strict'),
                            object_pairs_hook=_pairs, parse_float=Decimal,
                            parse_constant=_invalid_constant)
        if not isinstance(parsed, dict):
            raise PublicationContractError('invalid_spec_json')
        _walk(parsed)
    except (ValueError, UnicodeError, RecursionError, DecimalException):
        raise PublicationContractError('invalid_spec_json') from None
    # Exact immutable UTF-8 snapshot bytes; no normalization/reserialization.
    return hashlib.sha256(raw).hexdigest()


def _text(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 512:
        return False
    try:
        value.encode('utf-8', errors='strict')
    except UnicodeError:
        return False
    return not any(ord(c) < 32 for c in value)


def bound_claims(intent):
    """Return validated proposed claims, never an approval or AuthN assertion."""
    if not isinstance(intent, PublicationIntent):
        raise PublicationContractError('invalid_intent')
    if not all(_uuid(x) for x in (intent.tenant_id, intent.operation_id,
                                  intent.receipt_user_id, intent.session_id)):
        raise PublicationContractError('invalid_identity_binding')
    if (type(intent.generation) is not int or not 1 <= intent.generation < MAX_I64
            or type(intent.expected_revision) is not int
            or not 0 <= intent.expected_revision < MAX_I64):
        raise PublicationContractError('invalid_revision_or_generation')
    if intent.scope not in ('NORMAL', 'CRITICAL') or intent.version_kind not in KINDS:
        raise PublicationContractError('invalid_kind_or_scope')
    if (not isinstance(intent.module_id, str)
            or re.fullmatch(r'[a-z][a-z0-9._-]{0,127}', intent.module_id) is None):
        raise PublicationContractError('invalid_module')
    if intent.parent_version_id is not None and not _uuid(intent.parent_version_id):
        raise PublicationContractError('invalid_parent')
    if intent.decision_ref is not None and not _text(intent.decision_ref):
        raise PublicationContractError('invalid_decision_ref')
    if (intent.code_commit_sha is not None
            and (not isinstance(intent.code_commit_sha, str)
                 or re.fullmatch(r'[0-9a-f]{40}', intent.code_commit_sha) is None)):
        raise PublicationContractError('invalid_code_commit')
    if (intent.version_kind != 'DRAFT'
            and (intent.parent_version_id is None or intent.decision_ref is None)):
        raise PublicationContractError('missing_stage_references')
    if intent.version_kind == 'IMPLEMENTED_RELEASE' and intent.code_commit_sha is None:
        raise PublicationContractError('missing_stage_references')
    return {
        'domain': DOMAIN,
        'tenant_id': str(intent.tenant_id), 'operation_id': str(intent.operation_id),
        'receipt_user_id': str(intent.receipt_user_id), 'session_id': str(intent.session_id),
        'generation': intent.generation, 'scope': intent.scope,
        'module_id': intent.module_id, 'version_kind': intent.version_kind,
        'expected_revision': intent.expected_revision,
        'parent_version_id': str(intent.parent_version_id) if intent.parent_version_id else None,
        'decision_ref': intent.decision_ref, 'code_commit_sha': intent.code_commit_sha,
        'content_sha256': _spec_hash(intent.spec_json),
    }


def intent_sha256(intent):
    encoded = json.dumps(bound_claims(intent), sort_keys=True, ensure_ascii=True,
                         separators=(',', ':'), allow_nan=False).encode('ascii')
    return hashlib.sha256(encoded).hexdigest()


def compare_recovery(intent, stored):
    """Compare a server-read result; UNKNOWN is not proof of rollback/retry safety."""
    digest = intent_sha256(intent)
    if stored is None:
        return RecoveryMatch.UNKNOWN
    if (not isinstance(stored, StoredPublicationResult)
            or not all(_uuid(x) for x in (stored.tenant_id, stored.operation_id, stored.version_id))
            or not isinstance(stored.intent_sha256, str)
            or re.fullmatch(r'[0-9a-f]{64}', stored.intent_sha256) is None):
        raise PublicationContractError('invalid_stored_result')
    if (stored.tenant_id != intent.tenant_id or stored.operation_id != intent.operation_id
            or stored.intent_sha256 != digest):
        return RecoveryMatch.CONFLICT
    return RecoveryMatch.EXACT
