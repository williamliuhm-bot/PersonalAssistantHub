# B2/B3 I01–I03 — verified dependency-driven execution plan

**QA only.** Read active Supabase Working Rules before acting. Repo `williamliuhm-bot/PersonalAssistantHub`, branch `qa/blueprint-v06-b2b3-pg17-20261029`. Keep Phase 9 OFF, CX-174 BLOCKED, Release Gate LOCAL_REVIEW_READY. No Merge, Deploy, Production DB or paid provisioning.

## Verified code evidence
- `personal-assistant-hub/integration-service/app/blueprint_identity.py` contains a dormant, default-OFF `BlueprintIdentityBoundary`; it depends on a server-owned verified decoder and fresh `AuthorityProvider`. It does **not** implement live provider, route, membership/session persistence or publication transaction.
- Existing offline I01 tests: 26/26 PASS, **not** genuine AuthN E2E. Prior isolated PG17 SQL: 5/5 PASS, static 20/20 PASS, source 17/17 MATCH. Reuse evidence; no unnecessary reruns.
- Existing auth tokens identify integer users; no verified tenant/UUID receipt principal/session/generation mapping. Application version publication table/write path is not identified. Hosted shared PG17/TLS/worker ownership and quota not verified.

## Next executable microtasks (one at a time)
**I01-E1 (read-only source inventory, no Xiaomi secrets):** inspect `auth-service/app/main.py`, `auth-service/app/auth.py`, `auth-service/app/models.py`, Redis blacklist and integration-service authentication. Produce precise file:line references for cryptographic verifier, token revocation, user lookup and authoritative state gaps. Do not read .env values.

**I01-E2 (pure QA tests):** add tests for fail-closed composition when decoder/provider absent, invalid authority freshness, expiry during await, role downgrade and tenant crossing. Use synthetic fixtures only; do not label these live AuthN. Reuse already passing cases, add only genuinely uncovered cases.

**I01-E3 (contract decision):** document a proposed, reviewable server-owned integer user → tenant UUID/receipt-user UUID/session UUID/generation/membership mapping, including authoritative ownership, transaction locks, revocation and migration/rollback. Do not create schema or invent tenant IDs without approved contract.

**I02-E1 (read-only application contract):** inspect actual application version/publish paths, including migrations, not only ORM models. If absent, report exact missing contract and minimal additive QA schema proposal; no DDL or privilege changes yet.

**I03-E1 (read-only hosted resources):** inventory verified existing hosted resource IDs, plan/quota, TLS, shared store, worker capacity and ownership using authorized read-only connectors. Mark UNKNOWN where evidence absent. Do not probe endpoints or provision resources without authorization.

## Xiaomi delegation (active Working Rule)
- Send Xiaomi only a **single low-risk function, unit test or bounded source-review question** per call; minimal sanitized context, explicit output, small token cap.
- A no-text response counts as no deliverable even if token usage is reported. At most one targeted retry, then stop and use Codex/ChatGPT. Never delegate AuthN trust design, RLS, secrets, transaction security or deployment decisions to Xiaomi.
- Validate all generated code against actual source and run focused tests before committing.

## Completion reporting
For each microtask: actual source paths, diff/commit, PASS/FAIL/BLOCKED/NOT RUN, real Xiaomi input/output/total tokens, and remaining dependencies. Do not mark completed merely because a document or suggestion was written.
