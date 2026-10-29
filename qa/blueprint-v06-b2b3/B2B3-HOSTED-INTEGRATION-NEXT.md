# Blueprint Center v0.6 — B2/B3 → Hosted integration (Codex next task)

**Execution command:** 先讀取工作守則，開始工作。

## Verified starting point
- Repository: williamliuhm-bot/PersonalAssistantHub
- QA branch: qa/blueprint-v06-b2b3-pg17-20261029
- PG17 isolated SQL suite: 5/5 PASS, exit 0, 7,549 ms.
- Static: 20/20 PASS; checkout manifest: 17/17 MATCH.
- Evidence: qa/blueprint-v06-b2b3/PG17-RUNTIME-ACCEPTANCE.md and PG17-RUNTIME-RESULT.json.
- Do **not** rerun unchanged SQL tests or CX-174 ZIP/hash exercise.
- SQL success does **not** imply trusted backend, hosted integration or Production readiness.

## Implement in safe order

### B2B3-I01: trusted backend identity and session boundary
1. Inspect actual server routes, Supabase auth adapters, database schema and service boundaries. Read Working Rules, Master To-Do, Continuity Ledger before changing code.
2. Document how server-side verified identity is obtained; client-supplied tenant/user/role/session claims MUST NOT be authoritative. Fail closed for absent, expired or revoked identity.
3. Implement the minimal backend-only adapter behind a default-OFF feature flag; use existing credentials/connection facilities, never request or commit new secrets.
4. Unit/integration tests: forged user, tenant crossing, expired session, revoked membership, replay, stale generation and missing backend identity. Avoid real external calls unless already authorized.

### B2B3-I02: application version-table integration
1. Inspect real application version publication tables and the receipt/version commit interface; identify actual columns, transaction boundary, rollback strategy and current write path.
2. Add QA-only adapter connecting successful receipt consumption to version publication **atomically**, or document an explicit blocked dependency if impossible without schema changes.
3. Tests: content hash/module binding, idempotent retry, duplicate/replay, failed publish rollback, concurrent writers and denied direct writes.

### B2B3-I03: Hosted E2E readiness
1. Inventory current hosted worker slots, TLS/shared store, auth, receipt persistence, callback paths, quotas and expected additional costs using existing resources.
2. Produce a no-secrets Hosted E2E checklist with PASS/FAIL/BLOCKED and estimated cost. Do not provision paid resources or deploy.
3. If no-cost isolated hosted QA environment is already available and explicitly authorized, run only safe tests there; otherwise stop at readiness evidence and specify the minimal user decision required.

## Required outputs
- Code + targeted tests on QA branch only, with exact commits and observed PASS/FAIL/NOT RUN.
- Task tracker/Continuity Ledger sync when a **real** task ID is located. Otherwise PENDING_SYNC with proof; do not invent IDs.
- File `qa/blueprint-v06-b2b3/B2B3-HOSTED-INTEGRATION-STATUS.md` with implementation status, missing dependencies, security checks, hosted costs, rollback and next actionable step.
- Xiaomi input/output/total tokens from actual receipts (0 if unused); Codex token count unknown if not provided.

## Hard boundaries
No merge, deploy or Production modifications. Phase 9 OFF. CX-174 BLOCKED. Release Gate LOCAL_REVIEW_READY. No paid Watch/Research. No disabling security gates or substituting synthetic SQL PASS for hosted AuthN E2E.
