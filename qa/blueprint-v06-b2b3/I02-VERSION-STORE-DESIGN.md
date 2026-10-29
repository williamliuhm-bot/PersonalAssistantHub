# I02 — version store and atomic publication design

2026-10-29 HKT. **DRAFT FOR REVIEW; NO NEW SCHEMA, DDL, GRANTS OR DEPLOYMENT.** QA repository `williamliuhm-bot/PersonalAssistantHub`, branch `qa/blueprint-v06-b2b3-pg17-20261029`; source baseline `ea8eff87f5d41c735d682546b74e36a3f10c0266`.

## Starting point and decisions

Actual application source contains integer-user Auth, finance/tasks/notification tables and integration analytics tables; no application Blueprint version publisher/table has been identified. Existing isolated SQL `version_commits` is a four-column binding plus timestamp test sink, not an observed application version store. Do not silently adopt it as a deployed table. The Master SPEC's three logical core entities—modules, immutable versions, changes—remain the design basis; do not introduce another To-Do/approval/agent platform.

Receipt SQL and its previous PG17 5/5 PASS are unchanged and were not rerun. New tests here concern only a **pure, proposed QA data contract**, not a DB migration or a real publication transaction.

### Separate two hashes

- `content_sha256`: SHA-256 of the exact immutable UTF-8 JSON snapshot bytes, as selected by this proposed profile. No whitespace, Unicode or numeric reserialization occurs before hashing. A one-byte change is a different snapshot.
- `intent_sha256`: SHA-256 of a domain-separated, sorted-key ASCII JSON envelope containing tenant, operation, receipt principal, session, generation, scope, module, version kind, expected module revision, parent, immutable decision reference, code commit and content_sha256. Outer serialization is fixed by the draft helper; snapshot bytes themselves are never embedded in that envelope.

The QA-only domain is `blueprint-publication-intent/1-draft`. This is not an approved production receipt protocol. Do not substitute intent_sha256 for the existing Receipt SQL content_sha256 parameter. Eventual sealed issuance/consumption must bind a separately reviewed intent hash and preserve the old content meaning. Exact host/store audience, approved SPEC-schema identity/digest and permitted QA release semantics must also be confirmed and included in the eventual sealed profile before any live binding; this initial helper does not accept or attest them. A hash is not issuer attestation or approval.

## Proposed logical records and columns

Names/types below are a review specification, **not** installed tables or finalized migration names. Reuse an actual equivalent authoritative object if one is identified. Tenant/principal/session records and backend identities remain the separate I01 review dependency.

| Logical entity | Proposed fields | Constraints / ownership |
|---|---|---|
| blueprint_modules | tenant UUID, module key, nonnegative bigint revision, current approved-design version UUID nullable, current implemented-release version UUID nullable, existing module metadata | Composite identity `(tenant, module_key)`. One serialized revision/CAS per module. Two head references have independent kinds; a newer design must not silently replace the implemented-release head. |
| blueprint_versions | server-generated version UUID, tenant/module, resulting module revision, operation UUID, kind, exact JSON snapshot bytes, content_sha256, intent_sha256, parent version UUID nullable, immutable decision_ref nullable, code commit SHA nullable, server receipt-principal/session/generation/scope, server commit timestamp | Immutable insert-only records; unique `(tenant, operation)` and `(tenant, module, revision)`. Same-tenant/module parent/head references. No caller-chosen committed version ID. Changes create new versions; never update/delete an approved snapshot. |
| blueprint_changes | tenant/module, existing Task/PR/Commit/QA/Release references, risk, before/after version references, summary, sync status and server timestamps | Reuse existing integration references. Minor log-only sync must not become a new gate on core Watch/Research runtime. No duplicate work tracker. |
| Existing receipt/consumption operation journal, extended only after approval | current tenant/operation key, exact content binding plus new intent binding; immutable result version UUID and resulting revision | Reuse the durable receipt/consumption relationship where feasible; do not add a second competing operation truth. One operation has one exact immutable result. A preallocated server version UUID can satisfy a reviewed deferred FK cycle with consumption/version insert in one transaction. No partial-null committed result. |

### Snapshot representation and staging

Because this draft hashes exact bytes, a JSONB column alone cannot be the sole truth for that byte hash: JSONB changes representation. Proposed single truth is immutable UTF-8 JSON `spec_snapshot` bytes; JSON rendering/query views are derived from it. If owners instead select canonical semantic JSON/JSONB, define and version a canonicalization profile and update the reviewed receipt/intent protocol before use—do not change the hash meaning silently. The helper validates object-shaped UTF-8 JSON, rejects duplicate keys/non-finite numbers/surrogates and bounds parser input/depth, but is **not** the full application SPEC schema validator.

Draft QA parser limits (1 MiB snapshot, 64 depth), lowercase ASCII module keys, positive generation/nonnegative revision below bigint exhaustion, 40-character lowercase Git SHA and bounded reference syntax are proposed QA contract bounds. They are not deployed System Settings or approved application-wide policy. Real policy/configuration must follow Working Rules and the actual module registry.

| Kind | Required proposed references | Future server/transaction checks, not performed by the helper |
|---|---|---|
| DRAFT | Parent/decision/code references may describe observed provenance; none grants approval | Parent, if present, is an existing same-module committed version. Metadata presence never promotes the draft. |
| APPROVED_DESIGN | Parent + immutable decision reference | Parent is DRAFT; the approved snapshot matches that parent content; decision evidence genuinely approves that exact tenant/module/content/scope at the authoritative revision. |
| IMPLEMENTED_RELEASE | Parent + immutable decision reference + exact code commit | Parent is APPROVED_DESIGN; snapshot matches approved content; code/QA/release evidence and environment are genuinely verified under Release Gate. A QA fixture/commit or the enum string is not proof of deployment. |

Referential constraints and a future sealed publisher must enforce same tenant/module, allowed parent kind, older committed parent revision, valid heads and no self/cyclic parent references. A reference string passing syntax checks does not establish those relations. Different content requires a new draft and approval, not an in-place promotion with changed bytes.

## One-store publication transaction

Only an approved server-owned publisher facade may execute the following future algorithm. The current identity boundary and the QA helper do **not** implement it.

1. Resolve genuine current Auth/blacklist/account/session/membership state, then enter the approved store's one connection/transaction. Verify actual database/resource identity and bound audience. Cross-database receipt/application writes are blocked until a separately reviewed protocol exists; a callback is not atomicity.
2. Acquire locks in a common order: membership → session/fence → module head → receipt/operation. All enrollment/revocation/publish paths must participate. One request targets one module; multi-module operations are out of this proposal.
3. Recheck live role/scope, active flags, current generation and wall-clock conditions. Read the immutable committed operation result under the same operation serialization and fresh authorization.
4. If an exact committed operation already exists, return that server-read version reference after full identity/intent checks. Do not consume again or apply a new module-revision CAS to this read: another operation may legitimately have advanced the module since the original commit. Conflicting intent is denied/conflicted; a revoked caller cannot read an old result merely by knowing operation_id.
5. For a new operation only, require the current module revision to equal expected_revision. Validate the approved application SPEC schema/profile, parent kind/content and decision/code evidence. Match receipt identity/module/content and the reviewed full intent/profile. A receipt cannot be consumed after expiry; do not renew timestamps or issue a replacement implicitly.
6. Within the same transaction, consume, insert the immutable version/result, increment module revision and change only the appropriate approved-design/implemented-release head. Link the consumed operation to that exact version. A failure in any step rolls back all writes; a separately committed consumption is prohibited.
7. Commit once. Unknown ACK must be recovered by durable operation lookup under fresh authorization/locks. A missing or invisible row, a lock timeout or an unavailable store is UNKNOWN, not proof of rollback and not permission to rerun external AI/provider work. A DB-only retry is eligible only after serialization proves the prior outcome and all current new-operation checks still pass.

Same-module writers with different operations and the same expected revision serialize: one can publish; the other must get a revision conflict before consuming. Identical same-operation retries recover the one result; different payloads on that operation conflict. These are **required future DB tests**, not claimed by Python equality tests.

## Permission and migration review gates

No roles, grants, functions, tables or policies were created or modified. Proposed logical role separation for review:

- Untrusted client roles: no direct table writes or receipt/publisher EXECUTE; do not reuse a client-supplied trusted boolean.
- Reader: only a scoped sealed read after genuine current authorization, not blanket SELECT of token/session/version data.
- Issuer / publisher / revoker: separate server capabilities; issuer cannot publish directly, publisher cannot assign membership, revoker cannot rewrite history. Actual role names and grants await review.
- Table/function owner: NOLOGIN, NOBYPASSRLS with reviewed ENABLE/FORCE RLS and fixed safe search paths for any genuinely necessary definer facade. No permanent broad CREATE grant or privileged credential shared with clients.

Prepare a concrete additive **QA-only** migration only after C1–C3 choose real authorities, actual application table/connection identity, exact snapshot/intent profile, staged release semantics and privileges. Preserve the accepted standalone QA schema/evidence; do not backfill legacy receipts or redefine their hash/role semantics in place. Any new schema and permissions remain pending approval.

Rollback design: feature stays OFF; if a future QA adapter is enabled, first disable its entry point, then withdraw only its approved capability. Preserve immutable versions, consumed operations and audit references. Never delete committed consumption/version history, recycle IDs, disable RLS/FKs or cascade-drop evidence to make rollback appear clean. No rollback/deployment was performed here.

## Completed QA code and exact test scope

`publication_contract.py` provides structural validation, exact snapshot hashing, full draft-intent digest and `UNKNOWN`/`EXACT`/`CONFLICT` comparison of a future server-read result. It cannot authenticate, issue/consume a receipt, verify a decision or Git commit, reserve an operation, query a parent, publish a version or prove a DB commit. `EXACT` is equality only; `UNKNOWN` is not retry permission. No application route imports it.

Only the new `test_publication_contract.py` was executed. First run: **19 methods PASS, one ERROR** out of 20; an extreme valid-JSON numeric exponent caused Decimal conversion to escape the stable validation error. Added DecimalException handling, then reran **only that failed method**, PASS. Therefore all 20 unique new methods have passing evidence (19 retained from the first run + one targeted repair run); no full post-fix rerun is claimed. The narrow change only adds handling for the previously escaping Decimal error class. Existing identity 34/34, earlier static 20/20 and PG17 5/5 evidence were not rerun.

Tests cover kind/identity/operation/generation/scope/metadata binding, exact byte changes, duplicate keys, numeric/UTF-8/depth/size failures, required stage references, recovery mismatch and UNKNOWN. The one version-kind method was generated by Xiaomi from a bounded request, then reviewed and integrated by Codex. Database atomicity, concurrency, ACL, real identity, decision approval and Hosted E2E remain NOT RUN for this proposed version store.
