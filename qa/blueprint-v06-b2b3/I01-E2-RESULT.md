# I01-E2 — uncovered negative cases and actual QA repair

2026-10-29 HKT. QA branch `qa/blueprint-v06-b2b3-pg17-20261029` in `williamliuhm-bot/PersonalAssistantHub`. Baseline `be94450468fcf67b64c0e77c1ebdccee15c03eb9`.

**I01-E2 COMPLETE for this offline boundary test scope: 34/34 unit-test methods PASS, exit 0, 0.521 seconds.** Existing 26 test methods were retained; eight uncovered negative-case methods were added. These synthetic decoder/authority tests are not real JWT signature, AuthN, DB concurrency or Hosted E2E acceptance.

## Coverage delta only

| New test method | Gap relative to the previous 26 methods | Final |
|---|---|---|
| test_session_expires_during_authority_await | Prior awaited-IO test covered token expiry; it did not cover session expiry while the token remains valid. Xiaomi supplied this one bounded method, reviewed/reformatted by Codex. | PASS |
| test_authority_freshness_deadline_during_await | Prior tests used observations already stale before IO; this observation reaches its exact five-second deadline while IO completes. | PASS |
| test_role_downgrade_rechecks_without_stale_jwt_escalation | Prior tests covered a static viewer role and token revocation replay, not a live admin→approver role downgrade with an unchanged admin JWT claim. | PASS |
| test_generation_changed_during_lookup | Prior test supplied an already-stale expected generation; this fixture changes provider generation during resolution. Not a DB locking/concurrency proof. | PASS |
| test_clock_exception_before_or_after_lookup_is_redacted | Clock provider exceptions were not tested; now verifies stable reason code, suppressed exception context, no synthetic token in formatted traceback, and early dependency-call boundaries. | PASS |
| test_invalid_clock_value_before_or_after_lookup | Missing/naive server clock at either read was not covered. | PASS |
| test_clock_regression_after_lookup_is_denied | A backwards clock between verification and resolution was not covered. | PASS |
| test_unrepresentable_finite_expiry_is_denied | Prior huge-int test reached numeric validation; this finite epoch reaches datetime range conversion failure. | PASS |

Subtests are not counted as separate methods. No equivalent duplicate test was added for already-covered missing decoder/provider, basic tenant crossing, static role denial, static stale generation or basic revoked membership.

## First execution and narrow repair

The eight newly added methods were run first against the unchanged implementation, exit **1**. unittest reported **3 failures and 2 errors**, including subtest outcomes inside three problematic methods. The original raw log is retained in the task outputs; committed log copies normalize line endings and trailing spaces without changing diagnostic text.

- A clock callback raising an exception escaped as its raw exception rather than `BlueprintIdentityDenied`, potentially exposing its message/context in diagnostics. No authorization result was returned; this was an error-handling/redaction defect, not a demonstrated authorization bypass.
- Invalid or backwards clock after awaited IO was denied, but incorrectly classified as token expiry rather than server-clock failure.

Added private `_read_clock()` to validate aware timestamps and convert callback/validation exceptions into `invalid_server_clock` with suppressed context. Both time reads use the same helper. A backwards clock now also reports `invalid_server_clock`; actual access-token expiry still reports `expired_or_invalid_access_token`. No tenant, role, session, generation, expiry window, provider trust requirement or feature flag was weakened.

The full affected identity suite then passed **34/34**, exit **0**. Only the changed identity path was regression-tested. No PG17 SQL, schema, database creation, original manifest exercise, Auth routes, deployment or Production operation was run. Default OFF and missing-provider denial remain intact.

Changed runtime module: `personal-assistant-hub/integration-service/app/blueprint_identity.py`. Test file: `qa/blueprint-v06-b2b3/test_identity_boundary.py`.

## Evidence and remaining dependencies

- `i01-e2-evidence/new-cases-before-fix.log` / `.exit`
- `i01-e2-evidence/identity-after-fix.log` / `.exit`
- `i01-e2-evidence/result.json` — tested source SHA256, counts, scope and provider usage

Live verifier/blacklist, authoritative tenant/session/membership/UUID mapping, same-transaction receipt/publication integration and Hosted resources remain BLOCKED / NOT RUN. These results do not make I01 live integration complete. Prior PG17 5/5 PASS and original 20 static checks are reused unchanged, not rerun. Phase 9 OFF; CX-174 BLOCKED; Release Gate LOCAL_REVIEW_READY.

## I01-E3 continuation

Source-backed contract analysis is recorded in `I01-E3-IDENTITY-CONTRACT-PROPOSAL.md`: mapping ownership, raw-token blacklist versus fingerprint provider incompatibility, proposed async Auth resolution, same-store locks/fencing, revocation/unknown-ACK behavior, migration and rollback, and decisions C1–C4. **PROPOSAL READY FOR REVIEW**, not approved or implemented; no DDL/grants/Auth-flow changes.

Tracker lookup found no existing Blueprint/I01-E task row. **PENDING_SYNC**; no ID or completion receipt invented and no Production control-data write.

## This batch usage

Xiaomi 1 / mimo-v2.6-pro: **one** bounded test-method request, usable text returned, **zero retries**. Input **168**, Output **587**, Total **755** tokens; reasoning detail **491** (not added again). Only the session-expiry-during-await method came from Xiaomi; security repair and contract design were ChatGPT-led. Exact Codex token count **not provided**, no estimate. Commit is recorded by Git and the final task response; local/remote delivery status is verified separately rather than embedding a self-referential commit hash.
