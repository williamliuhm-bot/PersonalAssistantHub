#!/usr/bin/env bash
# B2/B3 QA only. Run ONLY against a disposable blueprint_qa_* PostgreSQL 17 database.
set -euo pipefail
cd "$(dirname "$0")"
: "${PGDATABASE:?PGDATABASE must be set to a disposable blueprint_qa_* database}"
case "$PGDATABASE" in blueprint_qa_*) ;; *) echo "REFUSED: non-QA database" >&2; exit 3;; esac
for file in 00_fence_candidate_v1.sql 01_consumption_extension.sql 02_receipt_content_binding.sql 03_security_hardening.sql 04_integrity_patch.sql 05_wall_clock_expiry.sql 06_final_all_functions_gate.sql acceptance.sql acceptance_extra.sql acceptance_wall_clock.sql acceptance_timed_expiry.sql SHA256SUMS.txt; do
  if [[ ! -s "$file" ]]; then echo "NOT RUN: missing $file" >&2; exit 3; fi
done
command -v sha256sum >/dev/null || { echo "NOT RUN: sha256sum missing" >&2; exit 3; }
sha256sum --check --status SHA256SUMS.txt || { echo "NOT RUN: source hash mismatch" >&2; exit 3; }
bash ./preflight_only.sh
echo "Preflight PASS; checking migration prerequisites"
# This runner is intentionally fail-closed. It will not run unless source hashes match.
# The migration scripts themselves include dependencies in acceptance.sql.
for file in acceptance.sql acceptance_extra.sql acceptance_wall_clock.sql acceptance_timed_expiry.sql 06_final_all_functions_gate.sql; do
  echo "Running $file"
  psql -X -v ON_ERROR_STOP=1 -d "$PGDATABASE" -f "$file"
done
echo "QA scripts finished; inspect individual assertions and evidence before claiming Runtime PASS"
