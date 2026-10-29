\set ON_ERROR_STOP on
-- Requires a fresh disposable PostgreSQL 17 database with acceptance.sql,
-- acceptance_extra.sql and acceptance_wall_clock.sql already executed.
DO $$ BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR current_database() !~ '^blueprint_qa_[a-z0-9_]+$' THEN
  RAISE EXCEPTION 'isolated PostgreSQL 17 blueprint_qa_* required';
 END IF;
END $$;
-- All operations occur in one transaction. transaction_timestamp() remains frozen,
-- whereas clock_timestamp() advances across pg_sleep.
DO $$
DECLARE t uuid := 'e1111111-1111-4111-8111-111111111111';
 u uuid := 'e2222222-2222-4222-8222-222222222222';
 s uuid := 'e3333333-3333-4333-8333-333333333333';
 op uuid := 'e4444444-4444-4444-8444-444444444444';
 h text := repeat('b',64);
 start_time timestamptz := clock_timestamp();
 n integer;
 rejected boolean := false;
BEGIN
 INSERT INTO blueprint_fence_qa.authorization_state
 (tenant_id,user_id,session_id,generation,active_session,active_membership,role)
 VALUES (t,u,s,1,true,true,'admin');
 -- Issue a QA-only near-expiry receipt by direct superuser seeding. This is NOT
 -- an API path, and does not modify existing immutable receipts.
 INSERT INTO blueprint_fence_qa.receipts
 (tenant_id,operation_id,user_id,session_id,generation,scope,issued_at,expires_at,module_id,content_sha256)
 VALUES (t,op,u,s,1,'NORMAL',start_time-interval '14 minutes 58 seconds',
         start_time+interval '2 seconds','timed-expiry',h);
 PERFORM pg_sleep(3);
 IF clock_timestamp() <= start_time+interval '2 seconds' THEN
  RAISE EXCEPTION 'clock did not advance beyond expiry';
 END IF;
 BEGIN
  PERFORM blueprint_fence_qa.consume_receipt(t,u,s,op,'timed-expiry',h);
 EXCEPTION WHEN insufficient_privilege THEN
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: expired receipt accepted'; END IF;
 SELECT count(*) INTO n FROM blueprint_fence_qa.receipt_consumptions
 WHERE tenant_id=t AND operation_id=op;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: rejected operation left consumption'; END IF;
 SELECT count(*) INTO n FROM blueprint_fence_qa.version_commits
 WHERE tenant_id=t AND operation_id=op;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: rejected operation left version'; END IF;
 RAISE NOTICE 'PASS: long-transaction wall-clock expiry and atomic rejection';
END $$;
