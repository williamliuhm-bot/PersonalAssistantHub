# I01-E3 — server-owned identity mapping contract proposal

2026-10-29 HKT. **PROPOSED / REVIEW REQUIRED. No schema, grants, Auth flow, routes or provider bindings were created.** Repository `williamliuhm-bot/PersonalAssistantHub`, QA branch `qa/blueprint-v06-b2b3-pg17-20261029`, analysis baseline `be94450468fcf67b64c0e77c1ebdccee15c03eb9` plus the I01-E2 clock handling fix.

## Observed source, not assumed deployment state

| Evidence | Source reference | Consequence |
|---|---|---|
| Integer user key; DB role/is_active | `personal-assistant-hub/auth-service/app/models.py:10`, `:14`, `:15` | Preserve the existing user key; do not reinterpret it as a UUID. |
| Access tokens have sub/role/type/iat/exp | `auth-service/app/auth.py:22` | No existing authoritative tenant/session/generation claim can be relied upon. |
| Cryptographic decoder | `auth-service/app/auth.py:43` | Reuse only the approved configured server verifier; never an unverified JWT parser or fallback signing-key configuration. |
| Redis blacklist lookup precedes user lookup | `auth-service/app/main.py:80`, `:93`, `:99`, `:111`, `:119` | JWT verification alone is insufficient: current revocation and active-user checks are separate. |
| Integration helper currently decodes a token and returns integer sub | `integration-service/app/auth.py:9` | This helper alone does not provide session/membership/epoch proof. |
| SQLAlchemy async sessions available | `integration-service/app/database.py:11`, `:18` | Reuse existing connection facilities only after actual store/role and transaction ownership are confirmed. |
| Dormant boundary requires decoder plus `AuthorityProvider` | `integration-service/app/blueprint_identity.py` | Flag stays OFF; enabling it cannot manufacture missing identity state. |

These paths are relative to `personal-assistant-hub/` after the first row. ORM/source searches found no durable tenant, membership, Auth session, integer-to-receipt-UUID registry or application Blueprint version publication table. The isolated QA `authorization_state` and `version_commits` are test contracts, not proof of such application tables. The Auth and integration source defaults name different databases; the production Compose override declares shared connection configuration. Neither proves that a deployed publisher and authority store are colocated. A single transaction must be confirmed against actual connection identity, not inferred from filenames or one PostgreSQL host.

## Proposed server-owned records (conceptual, no DDL)

The names below are review labels for an additive private QA design, **not** existing tables. No tenant UUIDs or membership assignments are selected by this proposal.

| Record | Key and required fields | Authoritative writer / invariants |
|---|---|---|
| Tenant registry | non-nil tenant UUID, active state, policy revision | Owner-approved tenant registry only. No default tenant, email-derived tenant or client-created tenant binding. |
| Principal binding | tenant UUID + existing auth user key; immutable non-nil receipt-user UUID | Unique `(tenant, auth_user_id)` and unique receipt principal binding. Auth key type must match actual users.id. Source user must exist and be active. Retired bindings cannot be reassigned to another user. |
| Tenant membership | tenant + receipt-user UUID, active state, Blueprint role, change revision | Dedicated authoritative membership writer. Blueprint roles viewer/approver/admin come from an explicit reviewed policy, not JWT role text. Existing Auth `user` must not silently become approver; Auth `admin` must not silently gain every tenant. |
| Session binding | non-nil session UUID, tenant/principal, active state, expiry, generation | Backend-owned durable record for a real authorized Auth session. Do not generate a session from the access token's iat, a user ID, caller JSON or a local fixture. |
| Access-token binding | SHA-256 fingerprint, session/principal binding, token expiry/type, revoked state | Auth-owned registration of a cryptographically verified access token; raw token exists only in request memory. Fingerprint must resolve one exact binding, not act as an authentication credential itself. Legacy/unregistered tokens fail closed until a separately approved enrollment policy exists. |
| Authorization fence | tenant/user/session UUID tuple; positive bigint generation, current role and active flags | Same-store state locked by receipt operations and revocation. Never wrap/recycle a generation; exhaustion denies new approval until reviewed. |

The tenant registry, membership writer, durable session/enrollment owner and role translation policy are still unselected dependencies. Returning a `CurrentAuthority` dataclass or setting a `verifiedByServer` boolean is not evidence that these writers or checks exist.

## Critical verifier/provider interface gap

The current callable decoder is synchronous and verifies token contents; the current provider receives only `sha256(raw_token)`. Existing Auth revocation checks use Redis key `blacklist:<raw_token>`. A fingerprint-only provider cannot recover that raw token or perform the existing blacklist check. Do not claim it can, store raw tokens to bridge the gap, or accept a client assertion that blacklist checking succeeded.

**Recommended contract for review:** a server-owned async Auth resolution boundary receives the raw token in request memory, performs signature/type/expiry, current blacklist and active-user checks through the existing approved Auth facilities, and resolves the durable session/membership/principal binding. Its result is trusted only by server composition, with a matching fingerprint and current observation time. Any unavailable source returns a deny/unknown result. This needs a reviewed async interface/composition change; the current sync decoder + fingerprint-only provider must not be enabled as though this is already implemented.

An alternative is an approved durable fingerprint revocation ledger maintained atomically by all Auth revocation paths. It is not present today. Redis blacklist and a separate SQL ledger cannot be declared atomic by adding two sequential writes. The async resolver alone also does not serialize an external blacklist update with SQL consumption: the authoritative same-store fence below remains required.

Program Login/Logout development is currently paused. Any session registration, token issuance/refresh or revocation hook touching those flows needs a separately explicit scope decision. This document does not resume them, create an endpoint or add credentials. No signing key values were read, requested or changed.

## Transaction and revocation contract

1. Verify the token through the genuine server Auth resolution boundary. Resolve the server-owned tenant/principal/session; validate the requested tenant and scope without trusting JWT role/tenant/session/generation fields.
2. In one approved PG database and one transaction/connection, lock the membership row, then session/fence rows, then receipt/operation row in a documented stable order. Concurrent publishers, membership changes and session enrollment must use that same order. Multi-session invalidation must not race enrollment of a fresh session.
3. Read current active states, role, expiry and generation under the locks. Match exact receipt tenant, principal, session, generation, scope, module and content digest, and check wall-clock expiry at consumption time. A previously returned `BlueprintIdentity` is not a reusable capability and cannot replace these checks.
4. Consume the bound receipt and insert the immutable application version + operation result on the same transaction. Failed publication rolls back consumption. A callback, separate DB, queue delivery or independently committed service operation is not this atomic boundary.
5. Membership/session/role/token revocation must acquire the same locks, fence affected authorization rows by incrementing generation and invalidate affected active states **before reporting successful revocation**. The authoritative DB fence must cover all affected sessions and concurrent enrollment. A Redis update by itself does not satisfy this contract; existing QA SQL expressly does not serialize external Auth revocation.
6. Redis can remain a revocation cache/mirror only under an approved reconciliation/acknowledgment policy. If the authoritative fence update or its commit acknowledgment is unknown, fail closed and recover by durable operation ID; do not return a false success or continue consumption on cached state. No cross-store all-or-nothing guarantee is assumed.

The previous PG17 suite proves the isolated SQL contract tested there; it does not prove this unimplemented provider, membership-lock protocol, application transaction, cross-process visibility or external Auth revocation. New actual integration tests are required only after the changed contract is implemented; do not rerun unchanged SQL now.

## Boundary output and clock contract

`CurrentAuthority` must be built from current server-owned records, include exact token fingerprint and existing integer user key, and bind non-nil tenant/receipt-user/session UUIDs. The observed generation and role must come from those records. `checked_at` is the fresh server observation time, not a client field or an old record's updated_at relabeled as fresh. The provider must not serve cached success after a state-source outage.

Timestamps are timezone-aware server values. The current boundary accepts authority younger than five seconds, rejects observations in the future and checks token/session expiry after awaited IO. Clock failure, invalid clock value or backwards clock returns `invalid_server_clock`; token expiry returns `expired_or_invalid_access_token`. I01-E2 verifies these local failures and no identity is returned. Cross-host skew must be measured and handled by a separately reviewed clock contract; do not widen acceptance windows merely to pass tests.

Returned identity carries only backend integer/UUID bindings, generation, scope, verification time and a bounded valid_until. It contains no raw token and is not a receipt. Authorization must be fresh again at transaction time; no caller-provided identity object, reused result or trusted boolean grants publication.

## Idempotency and publication dependency (I02)

Use the existing receipt operation scope `(tenant_id, operation_id)` and exact module/content binding. After an unknown commit acknowledgment, a server read under fresh authorization must recover the immutable operation result and match all request bindings before returning the original version reference. A different module/hash/tenant/principal/session/generation is a conflict or denial, not a new approval. A revoked request must not obtain sensitive result data solely because it knows an old operation ID.

The actual application version table, immutable version identifier, version-kind semantics (approved design versus implemented release), operation uniqueness and transaction connection remain unidentified. The QA `version_commits` sink is not selected as an application store. No publication schema, dual-write adapter, permissions or optimistic retry implementation is introduced by this proposal.

## Additive migration / rollback plan for later approval

Before DDL: approve tenant ownership and role mapping, identify real Auth/session authority and version table, confirm one-store transaction feasibility and least-privilege server identities, then review a concrete **QA-only** additive schema plan with FK/uniqueness, deny-by-default ACL/RLS, generation overflow, retention and synthetic fixtures. No existing user ID column is converted and no legacy token/membership is silently backfilled.

Stage new mapping/fence records and provider wiring with the feature OFF; test genuine signature verification, blacklist outage, absent mapping, membership/role/session races, stale generation, unknown-ACK retry, atomic publish rollback and independent concurrent writers in an explicitly authorized changed-path QA environment. Hosted resource identity/TLS/quota and any Auth-flow approval are separate gates.

Rollback: turn the new boundary OFF and withdraw only its approved QA entry points/privileges; preserve immutable receipts, versions and identity audit history. Keep additive mappings for investigation until deletion/retention is separately approved. Never cascade-drop publication evidence, recycle retired principal/session IDs, relax RLS or remove fences to roll back a deployment. No rollback operation was performed in this analysis.

## Review decisions still required

- **C1:** name the authoritative tenant/membership owner and explicit existing Auth-role → Blueprint-role policy; no implied grant from `admin` or `user`.
- **C2:** choose the approved durable session/enrollment and token-revocation integration scope, including the existing Login pause and async resolver interface change.
- **C3:** identify the application version table and same-connection authority/receipt/version transaction; approve a concrete additive QA schema only if needed.
- **C4:** name an existing isolated hosted resource and its owner/TLS/quota evidence before any hosted integration test or provisioning.

I01-E3 contract analysis is complete as a **reviewable proposal**. The contract is not approved or implemented, and live AuthN, application publication and Hosted E2E remain BLOCKED / NOT RUN. Phase 9 OFF; CX-174 BLOCKED; Release Gate LOCAL_REVIEW_READY.
