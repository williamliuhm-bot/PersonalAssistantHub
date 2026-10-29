# PA Hub B2/B3 PG17 integrated QA v3 — LOCAL, NOT DEPLOYED

## What was corrected
- Previous Batch 02 ACL gate ran BEFORE `05_wall_clock_expiry.sql` replaced the consumption function. Final gate now runs LAST.
- Previous gate checked only three function signatures, missing legacy overload and trigger helpers. This gate iterates ALL functions in the QA schema.
- PUBLIC is a pseudo-grantee; use `aclexplode(COALESCE(proacl,acldefault('f',proowner)))`, never `has_function_privilege('PUBLIC',...)`.
- Checks effective EXECUTE for `anon`, `authenticated`, and QA executor; checks SECURITY DEFINER owner, NOLOGIN/NOBYPASSRLS roles and FORCE RLS.
- Full batch retains actual 3-second wall-clock expiry test.

## Execution
Requires precreated isolated **PostgreSQL 17** database `blueprint_qa_*`, disposable privileges and `psql`. Run `PGDATABASE=blueprint_qa_example ./run_batch.sh`. Do NOT run on Supabase Production or the existing CX-174 hosted QA project. The latter has PostgreSQL 17.11 but database name `postgres`, is dedicated to CX-174 and is NOT a suitable disposable database for this runner.

## Evidence
Static Python tests and shell syntax validation are NOT PG17 runtime acceptance. No real SQL migrations have been executed. Supabase project list/read-only QA inspection established an existing PG17.11 hosted QA instance, but it was not modified. Trusted Auth, Receipt backend binding and production version table integration remain unimplemented. Release Gate BLOCKED.

MiMo was asked to review all-function ACL coverage but returned no text this round. The v3 fixes were authored and tested locally; do not attribute them to MiMo.

## v4: QA fixture collision fixed
`acceptance_extra.sql` and `acceptance_wall_clock.sql` previously seeded the SAME tenant/user/session/operation UUIDs. The second insert into `authorization_state` would fail with duplicate primary key when run sequentially. Wall-clock fixture UUIDs are now distinct. Added a regression test checking the collision cannot recur. This is a local fix, not a claim of PG17 execution.

## Additional review: schema/table effective grants
Final gate now verifies client/QA executor schema CREATE and table INSERT/UPDATE/DELETE effective privileges, and denies schema USAGE to anon/authenticated. The executor retains intentionally granted schema USAGE. This is additional defense-in-depth; still requires real PG17 execution.

## QA coverage clarity update
Missing `anon`/`authenticated` roles in standalone PostgreSQL are reported as NOT RUN, not silently counted as client-role ACL PASS. Wall-clock setup and real three-second timed expiry are separate checks. Static suite: 20/20 PASS. PostgreSQL runtime remains NOT RUN.
