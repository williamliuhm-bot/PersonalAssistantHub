#!/usr/bin/env bash
# QA ONLY: PostgreSQL 17 disposable database. Never use Production.
set -euo pipefail
cd "$(dirname "$0")"
: "${PGDATABASE:?Set PGDATABASE to isolated blueprint_qa_* database}"
[[ "$PGDATABASE" =~ ^blueprint_qa_[a-z0-9_]+$ ]] || { echo "REFUSED: non-QA database" >&2; exit 3; }
for file in 00_fence_candidate_v1.sql 01_consumption_extension.sql 02_receipt_content_binding.sql 03_security_hardening.sql 04_integrity_patch.sql 05_wall_clock_expiry.sql acceptance.sql acceptance_extra.sql acceptance_wall_clock.sql acceptance_timed_expiry.sql 06_final_all_functions_gate.sql README.md test_batch.py SHA256SUMS.txt; do
  [[ -s "$file" ]] || { echo "NOT RUN: missing $file" >&2; exit 3; }
done
command -v sha256sum >/dev/null || { echo "NOT RUN: sha256sum missing" >&2; exit 3; }
# Original archive hashes and the pre-fix ACL gate are retained in original/.
# Verify all current sources, including the hardened runner and corrected SQL gate.
sha256sum --check --status < SHA256SUMS.txt || {
 echo "NOT RUN: QA source SHA256 mismatch" >&2; exit 3;
}
[[ -f preflight_only.sh ]] || { echo "NOT RUN: missing PG17 preflight" >&2; exit 3; }
bash ./preflight_only.sh
for sql in acceptance.sql acceptance_extra.sql acceptance_wall_clock.sql acceptance_timed_expiry.sql 06_final_all_functions_gate.sql; do
 printf 'Running %s\n' "$sql"
 psql -X -v ON_ERROR_STOP=1 -d "$PGDATABASE" -f "$sql"
done
echo "QA execution completed; inspect receipts and test evidence before claiming PASS"
