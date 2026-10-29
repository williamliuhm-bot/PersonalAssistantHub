-- ISOLATED POSTGRESQL QA ONLY. Apply after 00 and 01 in a fresh disposable DB.
-- The receipt MUST bind to the exact module and content before issuance.
-- Existing receipts are intentionally not migrated: reject until re-issued.
ALTER TABLE blueprint_fence_qa.receipts
 ADD COLUMN module_id text,
 ADD COLUMN content_sha256 text;
ALTER TABLE blueprint_fence_qa.receipts
 ADD CONSTRAINT receipt_module_valid CHECK (module_id IS NOT NULL AND length(module_id) BETWEEN 1 AND 128) NOT VALID,
 ADD CONSTRAINT receipt_sha_valid CHECK (content_sha256 IS NOT NULL AND content_sha256 ~ '^[0-9a-f]{64}$') NOT VALID;
-- Fresh QA schema has no receipts; constraints are immediately validated there.
ALTER TABLE blueprint_fence_qa.receipts VALIDATE CONSTRAINT receipt_module_valid;
ALTER TABLE blueprint_fence_qa.receipts VALIDATE CONSTRAINT receipt_sha_valid;

-- Old issuance signature is removed, so callers cannot mint unbound receipts.
DROP FUNCTION blueprint_fence_qa.issue_receipt(uuid,uuid,uuid,uuid,text,bigint);
CREATE FUNCTION blueprint_fence_qa.issue_receipt(
 p_tenant uuid, p_user uuid, p_session uuid, p_operation uuid,
 p_scope text, p_expected_generation bigint, p_module text, p_sha256 text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = pg_catalog, blueprint_fence_qa AS $$
DECLARE a blueprint_fence_qa.authorization_state%ROWTYPE;
BEGIN
 IF p_tenant IS NULL OR p_user IS NULL OR p_session IS NULL OR p_operation IS NULL
    OR p_scope IS NULL OR p_scope NOT IN ('NORMAL','CRITICAL')
    OR p_expected_generation IS NULL OR p_module IS NULL OR length(p_module) NOT BETWEEN 1 AND 128
    OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN
   RAISE EXCEPTION 'invalid receipt request' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM blueprint_fence_qa.authorization_state
 WHERE tenant_id=p_tenant AND user_id=p_user AND session_id=p_session FOR UPDATE;
 IF NOT FOUND OR a.generation<>p_expected_generation OR NOT a.active_session
    OR NOT a.active_membership OR a.role NOT IN ('approver','admin')
    OR (p_scope='CRITICAL' AND a.role<>'admin') THEN
   RAISE EXCEPTION 'stale or revoked authorization' USING ERRCODE='42501';
 END IF;
 INSERT INTO blueprint_fence_qa.receipts
 (tenant_id,operation_id,user_id,session_id,generation,scope,module_id,content_sha256)
 VALUES(p_tenant,p_operation,p_user,p_session,p_expected_generation,p_scope,p_module,p_sha256);
END $$;
GRANT CREATE ON SCHEMA blueprint_fence_qa TO blueprint_fence_qa_owner;
ALTER FUNCTION blueprint_fence_qa.issue_receipt(uuid,uuid,uuid,uuid,text,bigint,text,text)
 OWNER TO blueprint_fence_qa_owner;
REVOKE CREATE ON SCHEMA blueprint_fence_qa FROM blueprint_fence_qa_owner;
REVOKE ALL ON FUNCTION blueprint_fence_qa.issue_receipt(uuid,uuid,uuid,uuid,text,bigint,text,text)
 FROM PUBLIC, blueprint_fence_qa_executor;

-- Replace consumption with exact receipt-to-commit binding; no EXECUTE grants.
CREATE OR REPLACE FUNCTION blueprint_fence_qa.consume_receipt(
 p_tenant uuid,p_user uuid,p_session uuid,p_operation uuid,
 p_module text,p_sha256 text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = pg_catalog, blueprint_fence_qa AS $$
DECLARE a blueprint_fence_qa.authorization_state%ROWTYPE;
        r blueprint_fence_qa.receipts%ROWTYPE;
BEGIN
 IF p_tenant IS NULL OR p_user IS NULL OR p_session IS NULL OR p_operation IS NULL
    OR p_module IS NULL OR length(p_module) NOT BETWEEN 1 AND 128
    OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid request' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM blueprint_fence_qa.authorization_state
 WHERE tenant_id=p_tenant AND user_id=p_user AND session_id=p_session FOR UPDATE;
 IF NOT FOUND OR NOT a.active_session OR NOT a.active_membership
    OR a.role NOT IN ('approver','admin') THEN
    RAISE EXCEPTION 'revoked authorization' USING ERRCODE='42501';
 END IF;
 SELECT * INTO r FROM blueprint_fence_qa.receipts
 WHERE tenant_id=p_tenant AND operation_id=p_operation FOR UPDATE;
 IF NOT FOUND OR r.user_id<>p_user OR r.session_id<>p_session
    OR r.generation<>a.generation OR r.issued_at>transaction_timestamp()
    OR r.expires_at<=transaction_timestamp()
    OR r.module_id IS DISTINCT FROM p_module
    OR r.content_sha256 IS DISTINCT FROM p_sha256
    OR (r.scope='CRITICAL' AND a.role<>'admin') THEN
    RAISE EXCEPTION 'invalid, mismatched or stale receipt' USING ERRCODE='42501';
 END IF;
 INSERT INTO blueprint_fence_qa.receipt_consumptions(tenant_id,operation_id)
 VALUES(p_tenant,p_operation);
 INSERT INTO blueprint_fence_qa.version_commits(tenant_id,operation_id,module_id,content_sha256)
 VALUES(p_tenant,p_operation,p_module,p_sha256);
END $$;
REVOKE ALL ON FUNCTION blueprint_fence_qa.consume_receipt(uuid,uuid,uuid,uuid,text,text)
 FROM PUBLIC, blueprint_fence_qa_executor;
