# B2/B3 I01 / I02 / I03 — offline integration checkpoint

2026-10-29 HKT. Repository `williamliuhm-bot/PersonalAssistantHub`, branch `qa/blueprint-v06-b2b3-pg17-20261029`, starting commit `55762ec2c3ab14ffcfe1ea4e22b44a8112258bf0`.

| Work item | Actual status |
|---|---|
| I01 backend identity boundary | OFFLINE ADAPTER IMPLEMENTED; latest I01-E2 34/34 unit tests PASS. Live verifier/session/authority composition BLOCKED. |
| I02 application publication | SCHEMA/WRITE-PATH INSPECTION COMPLETE; integration BLOCKED by absent application version tables and identity/session mapping. No speculative schema or publisher was created. |
| I03 hosted readiness | SOURCE INVENTORY COMPLETE; hosted identity, ownership, worker slots, TLS/store guarantees and quota/cost NOT VERIFIED. No deployment/provisioning/probes. |

Latest update: I01-E2 adds eight previously uncovered negative methods, repairs clock exception redaction/classification, and passes 34/34. See `I01-E2-RESULT.md`. I01-E3 contract analysis is a reviewable proposal in `I01-E3-IDENTITY-CONTRACT-PROPOSAL.md`; no schema or live provider was created. The original 26-test evidence below is retained as historical baseline, not relabeled as a new run.

## Preserved evidence and boundaries

The prior PG17.11 SQL suite remains 5/5 PASS, static 20/20 PASS, source manifest 17/17 MATCH, as recorded in `PG17-RUNTIME-ACCEPTANCE.md` and `PG17-RUNTIME-RESULT.json`. None of those tests or PostgreSQL databases was started, recreated or rerun in this batch. Their SQL, runner, manifest and evidence files are unchanged. Phase 9 OFF; CX-174 BLOCKED; Release Gate LOCAL_REVIEW_READY. No Merge, Deploy, Production write, paid Watch/Research, new connector, dependency installation or new secret.

## I01: implemented server-only boundary

New module: `personal-assistant-hub/integration-service/app/blueprint_identity.py`.

- Default OFF. `from_environment()` recognizes only server-side `BLUEPRINT_B2B3_IDENTITY_ENABLED=1`; the feature flag is not a request parameter. Enabling the flag with missing dependencies still denies.
- No route registration, startup hook, DB connection or changes to Login/Logout, existing JWT middleware, credentials or application settings. The module is not imported by the running application.
- Requires a server-owned cryptographic access-token decoder and fresh authority provider. It never parses JWT payloads itself, accepts an unverified decoder from HTTP, or falls back to a signing key. Injected implementations are part of the trusted server composition, not proven by these unit tests.
- Rejects missing/expired access claims, refresh tokens, invalid subjects, malformed tokens, missing authority, provider/verifier errors, cross-tenant identity, integer/UUID mapping mismatch, stale generation, inactive account/session/membership, revoked token, insufficient role, stale/future authority observations and expiry during awaited IO.
- JWT role/tenant/session/receipt-user/generation claims are ignored as authorization inputs. The authority provider must return those bindings from current server-owned state. Authority is queried on every call; no cached identity is used after an outage or revocation.
- Returns short-lived identity data, not a reusable publication receipt. The publisher must recheck/lock authority, consume the receipt and write the version in the same transaction. This new module does not claim to implement that transaction.
- Errors contain stable reason codes; tokens/provider exceptions are not exposed. No raw token is stored in the authority request or returned object; the provider receives its SHA-256 fingerprint.

### Actual existing Auth findings and unresolved bindings

`auth-service/app/main.py::get_current_user` uses the existing JWT decoder, Redis blacklist and DB user/is_active lookup. `auth-service/app/auth.py` issues integer-user access tokens with `sub`, `role`, `type`, `iat`, `exp`; no authoritative tenant, UUID principal, durable session ID or generation is present. `auth-service/app/models.py::User` contains integer id, role, is_active and subscription fields; no membership/session table. The gateway and integration-service currently decode tokens independently; they do not supply the required fresh membership/session/receipt generation state. No Supabase auth adapter was found in this designated application's source.

The three existing auth modules also contain fallback JWT key strings. This adapter is not wired to those defaults. Before live composition, verify the existing approved configured verifier and blacklist, and establish a server-owned integer-user → tenant/receipt-user/session UUID/generation mapping. Do not derive UUIDs, tenant or role from client JSON, pick a default tenant, mint a session from an unverified claim, or grant the QA executor function access to make integration appear complete.

The required mapping/provider and same-transaction lifetime are absent. Consequently I01 is an implemented dormant boundary with offline tests, not trusted backend AuthN E2E PASS. Real JWT signature verification and actual Auth/Redis/database integration were NOT RUN: the local interpreter does not have the existing service's jwt/FastAPI/SQLAlchemy dependencies installed. No new dependencies were installed.

### Threat review

Assets: raw access token, authoritative tenant/session mapping, generation/role and immutable publication. Trust boundaries: HTTP/client → cryptographic verifier → live server authority → future transactional receipt/publisher. No client-supplied identity can fill an absent backend dependency. The tests use synthetic decoder/authority fixtures explicitly; they do not attest a real issuer or DB lock.

| Threat | Implemented local control | Remaining gate |
|---|---|---|
| Forged claims / tenant crossing / role escalation | Decoder contract plus subject/fingerprint/UUID/tenant binding and server-authority role checks | Configure genuine verifier and authority adapter |
| Revocation / stale generation / token replay after revocation | Fresh provider request on each call; strict state, generation and wall-clock checks | Durable session/membership/blacklist source and cross-process fencing |
| Slow verification or authority IO | Re-read server clock after await; no request-start expiry shortcut | Genuine service timing/timeout tests |
| TOCTOU between identity and publish | No publication path is enabled; returned identity is not a capability | Same-connection transactional authority/receipt/version bridge |
| Error disclosure / secret exfiltration | No raw tokens in returned data/errors; static inventory never reads .env or outputs values | Hosted runtime log review before enablement |

## I02: concrete schema and transaction dependency

Read the actual ORM models across auth, finance, tasks, notification, integration and shared modules, along with integration database facilities and publication-related source searches. `integration-service/app/models.py` currently defines `productivity_reports` and `budget_forecasts`; its existing writers create analytical records and commit those independently. Its `app/database.py` exposes SQLAlchemy async sessions, not a Blueprint receipt/publication transaction. Shared/user models use integer IDs.

Source inventory found these application table declarations: accounts, budget_forecasts, budgets, categories, habit_logs, habits, notifications, productivity_reports, projects, tasks, telegram_link_tokens, telegram_links, transactions, users. No application Blueprint version/publication table, receipt operation journal, tenant membership/session mapping or publication write path was found. This is source evidence, not a query of a live database.

The isolated SQL candidate instead has UUID tenant/user/session, generation, receipts, receipt_consumptions and `version_commits(tenant_id, operation_id, module_id, content_sha256, committed_at)`. Its version_commits table is a QA test sink, not an observed application version store. Its executor has no EXECUTE or direct write grants; that deliberate denial is preserved. Existing successful SQL semantics cannot be relabeled application integration.

**Blocked contract:** identify the real application version table and fields, define authoritative integer-to-UUID mapping/session/membership/generation persistence, and select the server-owned same-database transaction facility and least-privilege publisher identity. Atomicity must cover locked current authority, exact receipt binding, consumption and version insert on one connection. A separate application DB or independently committed service callback is not an atomic replacement.

Idempotent unknown-ACK recovery must read the durable operation and compare tenant/module/content before returning the same version; conflicting/replayed operations must not create another version. Failed publication must roll back consumption. Concurrent writers/direct-write denial need actual adapter/DB verification after the real contract exists. New tests for those missing application operations are **NOT RUN**, rather than synthetic PASS. No guessed table, DDL, GRANT, fake transaction adapter or cross-database dual-write was introduced.

## I03: no-secrets hosted readiness checklist

`inventory_hosted_source.py` reads only the two Compose source files and ORM declarations. Its output is `integration-evidence/source-inventory.json`, explicitly `STATIC_SOURCE_ONLY_NOT_HOSTED_VERIFICATION`. It does not load .env, output YAML values/hosts/URLs, contact network, import application code or execute Compose. Actual source inventory succeeded; a synthetic smoke check verified it excludes private values and rejects unsupported tab indentation.

Base Compose declares 12 services: a PostgreSQL/Redis pair, six application/front-end services plus gateway, two Celery workers and one Celery scheduler. Production override declares 13 service blocks including Caddy; these are declarations, not free hosted slots. Base source image is PostgreSQL **16-alpine**; that is not evidence of a deployed PG17-compatible shared store. The prior isolated PG17.11 remains separate. Caddy config declares TLS-facing routes; it does not prove live certificates, shared-store TLS, callback entitlement or resource ownership. Deployment documentation references an upstream repository/server; it is not authorization to probe or modify them.

| Readiness item | Evidence/status |
|---|---|
| Required QA source/previous local SQL evidence | PASS: present; reused unchanged |
| Default-OFF identity boundary / negative cases | PASS offline only, 26 unit tests |
| Worker/scheduler source declarations | PASS static inventory: two workers, one scheduler |
| Live worker availability, slot count, concurrency, ownership | BLOCKED / NOT VERIFIED |
| Isolated hosted PG17 receipt store, TLS/hostname/CA and shared visibility | BLOCKED / NOT VERIFIED; source Compose declares PG16 |
| Genuine verifier, blacklist, authoritative session/membership provider | BLOCKED; no deployed binding or approved store mapping |
| Application version store and atomic publisher permissions | BLOCKED I02 |
| Blueprint receipt callback route/persistence/unknown-ACK recovery | BLOCKED; no application path found |
| Hosted auth/receipt/publication/revocation/expiry E2E | NOT RUN |
| Existing quotas, free allowance and expected hosted cost | UNKNOWN; no approved hosted resource/quota receipt available |
| Deployment/provisioning/callback registration | NOT RUN; forbidden in this task |

No new cloud resource is needed or incurred for this offline source/test batch. This does not imply hosted E2E will cost zero. A defensible hosted cost estimate needs verified existing resource identity/plan, spare worker slots, storage/network/log usage and free allowance. No paid service was provisioned and no fee estimate was invented.

### Next actionable decision

First identify/approve the actual authoritative identity/session/membership mapping and application version-table contract (or a separately reviewed additive QA schema plan). Then bind the dormant adapter using the existing verified decoder, blacklist and same-store transaction facilities. Separately designate an existing no-cost isolated hosted resource with owner/quotas/TLS proof and limited test authorization. Until these concrete dependencies exist, keep the feature OFF and do not deploy or repurpose the CX-174 hosted database.

## Prior offline batch verification, rollback and usage

Run only the changed-path offline tests:

`python -B qa/blueprint-v06-b2b3/test_identity_boundary.py -v`

From repository root, source inventory:

`python -B qa/blueprint-v06-b2b3/inventory_hosted_source.py personal-assistant-hub`

26/26 unittest methods PASS; multiple malformed-input/state cases are subtests and are not counted as separate tests. New Python files parse successfully. No application server/SQL/hosted test was run. The feature is OFF; no existing route imports the new module. Rollback is removal/revert of this QA-only module, tests/inventory and documentation; there are no new data/schema changes or credentials to roll back.

Master/Tracker lookup returned no existing Blueprint/B2B3 work item; latest Ledger remains snapshot 52 (CX-190). **PENDING_SYNC**: no fixed Task ID or completion receipt was invented, and no Production control records were written. Any future tracker update must use a real existing work item.

This batch Xiaomi: status configured for Xiaomi 1 / mimo-v2.6-pro. One low-risk inventory-script request failed `Transport closed`; no code or usage receipt returned. Input/Output/Total tokens are **UNKNOWN**, not zero or estimated. No retry. Codex implemented/reviewed the local fallback; all identity/security design stayed ChatGPT-led. Exact Codex tokens **not provided**.

An initial local branch synchronization review was rejected as a possible rewind. Read-only evidence then established parent `8aac961` → child `55762ec`, ahead 1/behind 0, one added handoff document; a guarded retry passed review and fast-forwarded the local ref without losing any Runtime commit. No bypass or force push was used.
