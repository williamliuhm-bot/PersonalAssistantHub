#!/usr/bin/env bash
# Blueprint v0.6 B2/B3 PG17 QA: safe preflight only.
# This script DOES NOT run migrations or assert runtime acceptance.
set -euo pipefail
: "${PGDATABASE:?Set PGDATABASE to isolated blueprint_qa_* database}"
case "$PGDATABASE" in blueprint_qa_*) ;; *) echo "FAIL: refusing non-QA database" >&2; exit 3;; esac
command -v psql >/dev/null || { echo "NOT RUN: psql missing" >&2; exit 3; }
export PGOPTIONS="-c default_transaction_read_only=on"
actual_db="$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'select current_database()')"
[[ "$actual_db" == "$PGDATABASE" ]] || { echo "FAIL: connected to unexpected DB $actual_db" >&2; exit 3; }
version="$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'show server_version_num')"
[[ "$version" =~ ^17[0-9]{4}$ ]] || { echo "FAIL: PostgreSQL 17 required ($version)" >&2; exit 3; }
roles="$(psql -X -A -t -v ON_ERROR_STOP=1 -c "select count(*) from pg_roles where rolname in ('anon','authenticated')")"
[[ "$roles" == "2" ]] || { echo "PARTIAL: anon/authenticated QA roles missing" >&2; exit 3; }
echo "PASS: isolated PostgreSQL 17 target and roles; SQL runtime acceptance NOT RUN"
