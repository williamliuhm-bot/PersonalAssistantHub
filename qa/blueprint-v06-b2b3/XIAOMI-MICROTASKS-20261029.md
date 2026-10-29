# B2/B3 microtasks — Xiaomi-assisted development batch 2026-10-29

Read Working Rules and B2B3-HOSTED-INTEGRATION-NEXT.md before execution. QA branch only. No Production, merge or deploy. Do not repeat completed PG17 tests.

## I01 trusted identity (priority)
- I01-A inspect existing backend auth provider and identify the exact server-verified identity object, membership lookup, revocation and session source. No assumptions about real tables.
- I01-B implement a server-only trust-boundary adapter behind default-OFF feature flag. Reject missing tenant/user/session, inactive membership, expired/revoked identity, stale generation, cross-tenant requests. Never accept a caller-supplied `verifiedByServer` boolean as proof.
- I01-C unit-test forgery, tenant crossing, expired/revoked session, missing claims and membership, and valid server-side verified identity.
- I01-D Codex security review and QA-only commit with test evidence.

## I02 version publishing
- I02-A inspect real application version table and current publication code; document missing schema mapping.
- I02-B implement adapter only after schema is confirmed. Receipt consumption and version publication must be atomic; reject replay and content/module mismatch.
- I02-C concurrency/idempotency and rollback tests, plus negative privilege tests.
- I02-D QA-only commit and evidence.

## I03 hosted readiness
- I03-A inventory two workers, shared store, TLS, AuthN, quota, cost and rollback using existing resource metadata.
- I03-B write a no-cost E2E plan with PASS/BLOCKED evidence and dependencies.
- I03-C run hosted tests only with already-authorized isolated resources; otherwise mark BLOCKED, no new paid provisioning.

## Xiaomi MiMo bounded batch observation
Four connector calls were made for development questions. First three calls returned **No text output** despite token usage; fourth (small TypeScript guard) returned code. The guard is **NOT** production-safe or integrated: a boolean `verifiedByServer` can be spoofed unless supplied exclusively by a trusted backend boundary. Codex must inspect actual auth architecture and not copy this code blindly.

Provider usage returned: first three 775 + 765 + 760 = 2300 tokens; fourth 241; batch **2541 total** (input 265, output 2276). No API key changes or transport diagnostics requested.

## Deliverables
For each microtask record source paths, actual implementation, tests and PASS/FAIL/BLOCKED. Keep PG17 5/5 PASS, static 20/20 PASS, 17/17 manifest MATCH as prior evidence, not newly rerun. Phase 9 OFF; CX-174 BLOCKED; Release Gate LOCAL_REVIEW_READY.
