# Blueprint Center v0.6 B2/B3 — PG17 QA handoff (NOT ACCEPTED)

Scope: **QA-only**, no merge/deploy/Production. Phase 9 OFF; CX-174 BLOCKED; Release Gate LOCAL_REVIEW_READY.

The source QA archive was generated in a separate ChatGPT sandbox and is **not present in this GitHub repository**. Creating this branch does NOT transfer that archive, and runtime tests are NOT RUN. Do not claim otherwise.

Expected source archive: `PA_Hub_B2B3_PG17_QA_20checks_Local.zip`
SHA-256: `f869d7689a0a1699768d961a6814a94305edf1a254d492f46697e370329f86ec`
Expected 15 files: `00_fence_candidate_v1.sql`, `01_consumption_extension.sql`, `02_receipt_content_binding.sql`, `03_security_hardening.sql`, `04_integrity_patch.sql`, `05_wall_clock_expiry.sql`, `06_final_all_functions_gate.sql`, `acceptance.sql`, `acceptance_extra.sql`, `acceptance_wall_clock.sql`, `acceptance_timed_expiry.sql`, `run_batch.sh`, `test_batch.py`, `README.md`, `SHA256SUMS.txt`.

Important: the archive's `run_batch.sh` is an older 544-byte runner, lacking later preflight hardening described in chat. Codex must review/merge latest preflight before executing migrations. Verify SHA256SUMS and compare against newer local work; no silent overwrite.

Codex has reported a local isolated PG17.11 database `blueprint_qa_b2b3_20261029` and QA roles. Check its actual presence and connectivity again. Only run on isolated `blueprint_qa_*` database; never Production or CX-174 hosted QA. Verify role grants, DB name, version, all-function PUBLIC ACL, receipt/revoke/replay/expiry/version publication tests. Record actual PASS/FAIL/NOT RUN.

**BLOCKED** pending actual QA SQL source transfer. This file is a checkpoint only, not an implementation.

## Codex actual local preflight — 2026-10-29 HKT

Tested branch commit: `4c00a2ba6535206dbdb560b3acca034b966b6d07`.

**PASS — environment preflight only, exit 0.** Executed this branch's `preflight_only.sh` using existing GNU Bash 5.2.37 and the existing isolated PostgreSQL 17.11 cluster. Actual target: `blueprint_qa_b2b3_20261029`, `127.0.0.1:55489`, `transaction_read_only=on`. Both `anon` and `authenticated` were verified NOSUPERUSER, NOBYPASSRLS, NOLOGIN. Server shut down cleanly afterward. Original TCP SCRAM authentication was retained; a discarded disposable QA admin credential was rotated locally without exporting it.

Initial invocation returned exit 3 (`NOT RUN: psql missing`). Setting the process PATH to the existing portable PostgreSQL bin resolved it; no installation was needed.

A QA-path-only `.gitattributes` rule now keeps shell files LF on Windows/Linux. The shell logic is unchanged. This portability suggestion came from Xiaomi MiMo and was applied/reviewed by Codex; the initial failure was PATH-related, not a demonstrated CRLF failure.

**B2/B3 Receipt SQL runtime remains BLOCKED / NOT RUN.** The 15 original SQL/runner/test files listed above are still missing. Issuance, consumption, identity, revocation, replay, publication, expiry, module RLS and PUBLIC ACL acceptance have not executed. No implementation was reconstructed from chat summaries. The source holder must transfer the actual files to this dedicated QA branch before those tests can run.

Machine-readable evidence: `qa/blueprint-v06-b2b3/PG17-PREFLIGHT-RESULT.json`.

This batch Xiaomi usage receipt: input 139, output 691, total 830 tokens; reasoning detail 587 (already within provider accounting, not added to total). Codex exact tokens unavailable. Phase 9 OFF; Release Gate LOCAL_REVIEW_READY. No Merge, Deploy or Production modifications.
