\set ON_ERROR_STOP on
-- Must run ONLY on disposable PostgreSQL 17, using a disposable superuser role.
DO $$ BEGIN
 IF current_setting('server_version_num')::int < 170000 OR current_setting('server_version_num')::int >= 180000 THEN
  RAISE EXCEPTION 'PostgreSQL 17 required'; END IF;
 IF current_database() !~ '^blueprint_qa_[a-z0-9_]+$' THEN
  RAISE EXCEPTION 'disposable blueprint_qa_* database required'; END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='blueprint_fence_qa') THEN
  RAISE EXCEPTION 'QA schema already exists'; END IF;
END $$;
\ir 00_fence_candidate_v1.sql
\ir 01_consumption_extension.sql
\ir 02_receipt_content_binding.sql
\ir 03_security_hardening.sql
\ir 04_integrity_patch.sql
DO $$
DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='blueprint_fence_qa' AND c.relkind='r' AND NOT c.relrowsecurity;
 IF n<>0 THEN RAISE EXCEPTION '% tables missing RLS', n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='blueprint_fence_qa' AND c.relkind='r' AND NOT c.relforcerowsecurity;
 IF n<>0 THEN RAISE EXCEPTION '% tables missing FORCE RLS', n; END IF;
 IF has_function_privilege('blueprint_fence_qa_executor',
 'blueprint_fence_qa.consume_receipt(uuid,uuid,uuid,uuid,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'executor must not be able to call consumption'; END IF;
 IF has_table_privilege('blueprint_fence_qa_executor',
 'blueprint_fence_qa.version_commits','INSERT') THEN
  RAISE EXCEPTION 'executor must not insert directly'; END IF;
 RAISE NOTICE 'PASS: baseline RLS and denied executor privileges';
END $$;
-- This block runs as superuser only in a disposable QA database, to seed
-- authoritative state and exercise function semantics without granting API access.
DO $$
DECLARE t uuid:='11111111-1111-4111-8111-111111111111';
 u uuid:='22222222-2222-4222-8222-222222222222';
 s uuid:='33333333-3333-4333-8333-333333333333';
 op uuid:='44444444-4444-4444-8444-444444444444';
 op2 uuid:='55555555-5555-4555-8555-555555555555';
 h text:=repeat('a',64); n integer;
BEGIN
 INSERT INTO blueprint_fence_qa.authorization_state VALUES(t,u,s,1,true,true,'admin');
 PERFORM blueprint_fence_qa.issue_receipt(t,u,s,op,'CRITICAL',1,'module-a',h);
 BEGIN
  PERFORM blueprint_fence_qa.consume_receipt(t,u,s,op,'module-b',h);
  RAISE EXCEPTION 'FAIL: wrong module accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 SELECT count(*) INTO n FROM blueprint_fence_qa.receipt_consumptions;
 IF n<>0 THEN RAISE EXCEPTION 'mismatch left consumption'; END IF;
 PERFORM blueprint_fence_qa.consume_receipt(t,u,s,op,'module-a',h);
 SELECT count(*) INTO n FROM blueprint_fence_qa.version_commits;
 IF n<>1 THEN RAISE EXCEPTION 'missing commit'; END IF;
 BEGIN
  PERFORM blueprint_fence_qa.consume_receipt(t,u,s,op,'module-a',h);
  RAISE EXCEPTION 'FAIL: replay accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 PERFORM blueprint_fence_qa.issue_receipt(t,u,s,op2,'NORMAL',1,'module-a',h);
 PERFORM blueprint_fence_qa.revoke_authorization(t,u,s,false,true,'admin');
 BEGIN
  PERFORM blueprint_fence_qa.consume_receipt(t,u,s,op2,'module-a',h);
  RAISE EXCEPTION 'FAIL: revoked session accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 SELECT count(*) INTO n FROM blueprint_fence_qa.version_commits;
 IF n<>1 THEN RAISE EXCEPTION 'revoked operation wrote commit'; END IF;
 RAISE NOTICE 'PASS: content mismatch, success, replay, revocation';
END $$;
-- QA database should be destroyed after capturing evidence.
