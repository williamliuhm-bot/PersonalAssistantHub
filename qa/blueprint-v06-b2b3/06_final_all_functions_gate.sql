-- FINAL fail-closed check, after ALL migrations including 05_wall_clock_expiry.sql.
-- QA-only: requires isolated disposable PG17 database with strict name guard.
DO $qa_gate$
DECLARE p record; role_name text; public_exec boolean; allowed boolean;
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR current_database() !~ '^blueprint_qa_[a-z0-9_]+$'
 THEN RAISE EXCEPTION 'Disposable PostgreSQL 17 blueprint_qa_* database required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='blueprint_fence_qa')
 THEN RAISE EXCEPTION 'Missing QA schema'; END IF;
 -- ALL functions including legacy overloads and trigger helpers, not just 3.
 FOR p IN
   SELECT pr.oid, pr.proname, pr.proacl, pr.proowner, pr.prosecdef
   FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace
   WHERE ns.nspname='blueprint_fence_qa'
 LOOP
   SELECT EXISTS (
     SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
     WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'
   ) INTO public_exec;
   IF public_exec THEN RAISE EXCEPTION 'PUBLIC EXECUTE on %',p.oid::regprocedure; END IF;
   FOREACH role_name IN ARRAY ARRAY['anon','authenticated','blueprint_fence_qa_executor'] LOOP
     IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
       SELECT has_function_privilege(role_name,p.oid,'EXECUTE') INTO allowed;
       IF allowed THEN RAISE EXCEPTION '% EXECUTE on %',role_name,p.oid::regprocedure; END IF;
     END IF;
   END LOOP;
   IF p.prosecdef AND p.proowner <> (SELECT oid FROM pg_roles WHERE rolname='blueprint_fence_qa_owner')
   THEN RAISE EXCEPTION 'SECURITY DEFINER has unexpected owner: %',p.oid::regprocedure; END IF;
 END LOOP;
 -- Explicitly report absent Supabase client roles in standalone PostgreSQL QA.
 -- Missing roles are NOT a PASS for client-role privilege checks.
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
     RAISE NOTICE 'NOT RUN: client role % absent; repeat ACL gate in Supabase-compatible isolated QA',role_name;
   END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM pg_proc candidate_proc JOIN pg_namespace n ON n.oid=candidate_proc.pronamespace
   WHERE n.nspname='blueprint_fence_qa')
 THEN RAISE EXCEPTION 'No functions in QA schema'; END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN
   ('blueprint_fence_qa_owner','blueprint_fence_qa_executor'))<>2
 THEN RAISE EXCEPTION 'Missing dedicated QA roles'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
   ('blueprint_fence_qa_owner','blueprint_fence_qa_executor')
   AND (rolcanlogin OR rolbypassrls))
 THEN RAISE EXCEPTION 'QA role LOGIN or BYPASSRLS'; END IF;
 IF EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='blueprint_fence_qa' AND c.relkind IN ('r','p')
   AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
 ) THEN RAISE EXCEPTION 'QA table lacks RLS or FORCE RLS'; END IF;
 -- Verify effective schema and table privileges as well as function EXECUTE.
 -- Public schema USAGE is denied; client roles must not gain schema CREATE.
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','blueprint_fence_qa_executor'] LOOP
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
     IF has_schema_privilege(role_name,'blueprint_fence_qa','CREATE')
       OR has_schema_privilege(role_name,'blueprint_fence_qa','USAGE')
          AND role_name <> 'blueprint_fence_qa_executor'
     THEN RAISE EXCEPTION 'Unexpected QA schema privileges for %',role_name; END IF;
     IF EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='blueprint_fence_qa' AND c.relkind IN ('r','p')
       AND (has_table_privilege(role_name,c.oid,'INSERT')
         OR has_table_privilege(role_name,c.oid,'UPDATE')
         OR has_table_privilege(role_name,c.oid,'DELETE'))
     ) THEN RAISE EXCEPTION 'Unexpected QA table write privilege for %',role_name; END IF;
   END IF;
 END LOOP;
 RAISE NOTICE 'PASS: final all-function ACL, owner, roles and RLS gate';
END $qa_gate$;
