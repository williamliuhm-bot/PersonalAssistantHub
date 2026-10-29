\set ON_ERROR_STOP on
-- Run only AFTER acceptance.sql, on a disposable QA database.
DO $$
DECLARE n int; BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR current_database() !~ '^blueprint_qa_[a-z0-9_]+$' THEN
   RAISE EXCEPTION 'PostgreSQL 17 disposable QA database required';
 END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='blueprint_fence_qa' AND c.relkind='r';
 IF n<>4 THEN RAISE EXCEPTION 'expected exactly 4 QA tables, got %', n; END IF;
 IF has_schema_privilege('blueprint_fence_qa_executor','blueprint_fence_qa','CREATE')
    OR has_table_privilege('blueprint_fence_qa_executor','blueprint_fence_qa.receipts','INSERT')
    OR has_table_privilege('blueprint_fence_qa_executor','blueprint_fence_qa.receipt_consumptions','INSERT')
    OR has_table_privilege('blueprint_fence_qa_executor','blueprint_fence_qa.authorization_state','UPDATE')
 THEN RAISE EXCEPTION 'executor has forbidden direct write privilege'; END IF;
 IF has_function_privilege('blueprint_fence_qa_executor',
 'blueprint_fence_qa.issue_receipt(uuid,uuid,uuid,uuid,text,bigint,text,text)','EXECUTE')
 OR has_function_privilege('blueprint_fence_qa_executor',
 'blueprint_fence_qa.revoke_authorization(uuid,uuid,uuid,boolean,boolean,text)','EXECUTE')
 THEN RAISE EXCEPTION 'executor can issue or revoke'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('blueprint_fence_qa_owner','blueprint_fence_qa_executor')
 AND (rolcanlogin OR rolbypassrls)) THEN RAISE EXCEPTION 'unsafe QA role attributes'; END IF;
 RAISE NOTICE 'PASS: four tables and executor effective privilege isolation';
END $$;
-- Validate transaction rollback on rejected content and prevent partial writes.
DO $$
DECLARE t uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 u uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 s uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 op uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 n int;
BEGIN
 INSERT INTO blueprint_fence_qa.authorization_state VALUES(t,u,s,1,true,true,'admin');
 PERFORM blueprint_fence_qa.issue_receipt(t,u,s,op,'CRITICAL',1,'module-x',repeat('a',64));
 BEGIN
  PERFORM blueprint_fence_qa.consume_receipt(t,u,s,op,'module-x',repeat('b',64));
  RAISE EXCEPTION 'wrong content was accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 SELECT count(*) INTO n FROM blueprint_fence_qa.receipt_consumptions WHERE tenant_id=t;
 IF n<>0 THEN RAISE EXCEPTION 'failed transaction left consumption'; END IF;
 SELECT count(*) INTO n FROM blueprint_fence_qa.version_commits WHERE tenant_id=t;
 IF n<>0 THEN RAISE EXCEPTION 'failed transaction left commit'; END IF;
 PERFORM blueprint_fence_qa.consume_receipt(t,u,s,op,'module-x',repeat('a',64));
 SELECT count(*) INTO n FROM blueprint_fence_qa.version_commits WHERE tenant_id=t;
 IF n<>1 THEN RAISE EXCEPTION 'valid commit missing'; END IF;
 RAISE NOTICE 'PASS: mismatch rollback and valid commit';
END $$;
