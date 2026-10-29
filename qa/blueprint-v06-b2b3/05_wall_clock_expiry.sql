-- QA-only. Enforce real wall-clock expiry, not transaction start time.
-- Existing consume_receipt uses transaction_timestamp() (fixed at BEGIN),
-- permitting a long-running transaction to consume after expiration.
BEGIN;
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
    OR r.generation<>a.generation OR r.issued_at>clock_timestamp()
    OR r.expires_at<=clock_timestamp()
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
COMMIT;
