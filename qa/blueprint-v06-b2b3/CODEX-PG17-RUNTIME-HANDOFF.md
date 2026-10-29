# B2/B3 PG17 runtime — Codex execution handoff (2026-10-29)

**Instruction:** 先讀取工作守則，開始工作。

Repo: williamliuhm-bot/PersonalAssistantHub  
Branch: qa/blueprint-v06-b2b3-pg17-20261029  
Directory: qa/blueprint-v06-b2b3/  
Isolated DB (existing, if clean): blueprint_qa_b2b3_20261029, PostgreSQL 17.11

## Execute, not just plan

1. Read Working Rules, Master To-Do and Continuity Ledger. Confirm branch HEAD.
2. Check every original source against SHA256SUMS.txt. Hardened run_batch.sh intentionally differs from original; inspect and validate it separately. Never exempt SQL from hash verification.
3. Confirm preflight_only.sh, runner order, PG17 version, QA DB name and isolation. Use a **fresh** disposable blueprint_qa_* DB if existing DB is not clean. Never run on production.
4. Run python test_batch.py, then complete SQL runtime: acceptance.sql, acceptance_extra.sql, acceptance_wall_clock.sql, acceptance_timed_expiry.sql, 06_final_all_functions_gate.sql. Record PostgreSQL version, each exit code, assertions, errors and elapsed time.
5. Fix QA-only failures in this branch; rerun affected tests. Capture test evidence and SHA differences for any changed source. Distinguish static PASS from actual PG17 runtime PASS.
6. Update the task tracker and continuity state with real evidence. Report verified Xiaomi usage (0 if unused) and actual Codex usage if available; otherwise unknown.

## Hard restrictions
- No merge, no Production deploy or Production DB modification.
- Phase 9 OFF; CX-174 BLOCKED; Release Gate LOCAL_REVIEW_READY.
- Do not repeat CX-174 original ZIP/hash task.
- Do not trigger paid Market Watch or Research.
- No secrets in committed evidence.
- Current known status before this handoff: 20/20 static QA PASS; PG17 runtime NOT RUN. Original 02_receipt_content_binding.sql is on QA branch (commit eca7e666). All seven core SQL files are present, but this is not a runtime PASS.

## Completion evidence required
A table for each PG17 test with PASS / FAIL / NOT RUN, actual output/exit code, SHA256 source validation, final QA branch HEAD, blockers, and confirmation that Production remained unchanged.
