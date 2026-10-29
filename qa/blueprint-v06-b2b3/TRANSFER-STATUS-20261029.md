# B2/B3 QA source transfer status — 2026-10-29
The original 15-file archive is available in the ChatGPT execution sandbox, but GitHub/Codex do not have direct access to that sandbox. The source archive has passed ZIP integrity and internal SHA256SUMS verification locally. This does **not** verify GitHub copies.

**STOP: Do not run migrations yet.** The GitHub QA branch contains partial, unverified source files. The 02 receipt-content-binding file and multiple acceptance scripts are absent. Some SQL uploads were rejected by the integration safety gate. Do not bypass those checks or replace the source with improvised SQL.

Codex: use this branch only for reviewing the existing partial work. Once a trusted source transfer is available, compare each file SHA-256 with the archive, verify the latest preflight runner, then run tests against the existing disposable PG17.11 QA database only. Never run against Production or the CX-174 hosted QA project. Keep Phase 9 OFF, CX-174 BLOCKED, and Release Gate LOCAL_REVIEW_READY.

QA branch: qa/blueprint-v06-b2b3-pg17-20261029
Archive SHA-256: f869d7689a0a1699768d961a6814a94305edf1a254d492f46697e370329f86ec
