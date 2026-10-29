# Blueprint Center B2/B3 — actual PostgreSQL 17.11 acceptance

2026-10-29 HKT. **Supplied isolated SQL runtime suite: PASS, 5/5 scripts.** This is not hosted/backend authentication or Production acceptance.

Repository: `williamliuhm-bot/PersonalAssistantHub`; branch: `qa/blueprint-v06-b2b3-pg17-20261029`.

Received source HEAD: `6f2e0cb0d051e0ef81f6ba3061435da5d1f8b9c8`. Current reviewed file hashes are recorded in SHA256SUMS.txt and PG17-RUNTIME-RESULT.json; the final published commit is reported separately to avoid a self-referential commit hash.

## Actual results

| SQL script | Result | Exit | Whole-second elapsed |
|---|---|---:|---:|
| acceptance.sql | PASS: install 00-04; RLS/denied executor privileges; receipt module mismatch, valid consume/version commit, replay and revocation | 0 | 0 |
| acceptance_extra.sql | PASS: four-table privilege isolation, wrong-content rollback and valid commit | 0 | 1 |
| acceptance_wall_clock.sql | PASS: installs 05 and issues valid receipt | 0 | 0 |
| acceptance_timed_expiry.sql | PASS: actual pg_sleep(3), long-transaction expiry rejected atomically, no consumption/version residue | 0 | 3 |
| 06_final_all_functions_gate.sql | PASS: all-function PUBLIC/client/executor ACL; definer owner; role attributes; FORCE RLS; schema/table effective rights | 0 | 1 |

Complete run_batch.sh exit **0**, measured **7,549 ms** overall. Per-script timing uses Bash's integer SECONDS counter and has one-second granularity. Original static test_batch.py: **20/20 PASS** after the runner required-file ordering correction; static results are separate from the SQL suite above.

The existing local PG17.11 cluster was reused, bound to 127.0.0.1:55489. First SQL execution used `blueprint_qa_b2b3_20261029`. Because that attempt installed a schema before the final gate failed, the corrected complete batch ran in a new disposable database **blueprint_qa_b2b3_recheck_20261029** inside the same cluster. Original failed database and logs were retained. No cluster recreation or unrelated PG preflight exercise.

Final inventory: four QA tables all ENABLE/FORCE RLS; two version_commits and two receipt_consumptions from the synthetic positive cases. Server shut down cleanly. Live/backend AuthN and application version-table publication integration remain unimplemented; external Auth revocation, hosted E2E and independent-session concurrency were NOT RUN. All test identities/data were synthetic.

## Failures and narrow fixes

1. Initial static result: 19/20 PASS. The original test inspected first filename occurrences, so the runner's required-file list put the final gate before timed expiry even though its execution loop was correct. Ordered the existence-check list consistently; no test assertion or SQL behavior was weakened.
2. Windows checkout changed LF source bytes to CRLF. All 13 original Git blobs other than the explicitly hardened runner matched the original manifest before modification. Extended QA-only .gitattributes rules to SQL/Python/Markdown/text and restored LF; original SQL content was not substituted.
3. First shell attempt: Git usr/bin was absent from process PATH, so dirname was unavailable. No migration ran. Added the existing bundled Git tools to the local execution environment. Bundled GNU Bash is named sh.exe and has no sha256sum.exe; local shell functions map bash to that existing binary and sha256sum --check --status to a Python hashlib adapter. The actual repository run_batch.sh and its complete SQL loop were executed; no checksum validation was skipped.
4. First SQL attempt: the first four SQL scripts passed, but final gate exited 3: `record "p" has no field "pronamespace"`. PL/pgSQL record p shadowed a pg_proc alias in an EXISTS query. Changed that inner alias to candidate_proc. ACL/RLS conditions remain intact. The entire corrected batch passed in the fresh QA database.

Preserved `original/SHA256SUMS.txt` and `original/06_final_all_functions_gate.sql`. Current SHA256SUMS verifies **17/17 entries**, including all current original sources, hardened runner, fixed SQL gate, preflight, and archived originals. No SQL is exempt. Source audit records original/received/current SHA256 for every original manifest entry. The original ZIP container itself was not locally received or rehashed; validation was against the transferred source blobs and original manifest.

## Evidence

- [Final runtime log](runtime-evidence/runtime-final.log)
- [SQL exits/timings](runtime-evidence/sql-steps.tsv)
- [Actual target](runtime-evidence/actual-target.log)
- [Inventory](runtime-evidence/inventory.log)
- [Shutdown](runtime-evidence/stop.log)
- [Source SHA audit](runtime-evidence/source-sha-audit.json)
- [Original static failure](runtime-evidence/static-original.log)
- [Final static result](runtime-evidence/static-final.log)
- [First shell failure](runtime-evidence/runtime-first-shell-failure.log)
- [First SQL/final-gate failure](runtime-evidence/runtime-first-sql-failure.log)

## Boundaries and status

Only the dedicated QA branch and local isolated databases were modified. No Production writes, Merge, Deploy, paid Watch/Research, new connector/service, or CX-174 ZIP/hash exercise. Phase 9 OFF; CX-174 BLOCKED; Release Gate LOCAL_REVIEW_READY. Original README/transfer audit describe historical pre-runtime status; this report supersedes that status only for the supplied isolated SQL suite.

Tracker/Ledger: **PENDING_SYNC**. Live lookup found no existing Blueprint task/CX record to attach an executor receipt to. No task ID, completion receipt or new continuity record was fabricated; no Production control-data write was made.

This batch Xiaomi: **1 call**, returned **No text output**; Input **231**, Output **1,400**, Total **1,631** tokens. Raw reasoning detail **1,402** exceeds output in the connector receipt; preserved as returned, not corrected or added again. Codex exact tokens **not provided**. No Xiaomi code was integrated in this batch; after its bounded failed output, Codex made the narrow fixes and ChatGPT reviewed the security gate.
