\set ON_ERROR_STOP on
-- Run AFTER acceptance.sql and acceptance_extra.sql on disposable PG17 QA DB.
DO $$ BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN
  RAISE EXCEPTION 'PostgreSQL 17 required'; END IF;
 IF current_database() !~ '^blueprint_qa_[a-z0-9_]+$' THEN
  RAISE EXCEPTION 'disposable blueprint_qa_* database required'; END IF;
END $$;
\ir 05_wall_clock_expiry.sql
-- Verify that wall-clock patch installs and issues a receipt; actual expiry is tested in acceptance_timed_expiry.sql.
DO $$
DECLARE t uuid:='a1111111-1111-4111-8111-111111111111';
 u uuid:='b2222222-2222-4222-8222-222222222222';
 s uuid:='c3333333-3333-4333-8333-333333333333';
 op uuid:='d4444444-4444-4444-8444-444444444444';
 n int;
BEGIN
 INSERT INTO blueprint_fence_qa.authorization_state VALUES(t,u,s,1,true,true,'admin');
 PERFORM blueprint_fence_qa.issue_receipt(t,u,s,op,'NORMAL',1,'expiry-test',repeat('a',64));
 -- This receipt is intentionally valid; the next script performs real-time expiry.
 SELECT count(*) INTO n FROM blueprint_fence_qa.receipts WHERE tenant_id=t;
 IF n<>1 THEN RAISE EXCEPTION 'receipt seed failed'; END IF;
 RAISE NOTICE 'PASS: wall-clock patch installed; timed expiry test follows';
END $$;
