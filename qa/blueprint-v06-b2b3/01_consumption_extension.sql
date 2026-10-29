-- QA-only extension. Apply after 00_fence_candidate_v1.sql in a fresh isolated PostgreSQL database.
-- No client grants. All privileged functions remain inaccessible to PUBLIC and executor.
ALTER TABLE blueprint_fence_qa.receipts
  ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (transaction_timestamp() + interval '15 minutes'),
  ADD CONSTRAINT receipt_validity_window CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '15 minutes');

CREATE TABLE blueprint_fence_qa.version_commits (
 tenant_id uuid NOT NULL, operation_id uuid NOT NULL,
 module_id text NOT NULL CHECK (length(module_id) BETWEEN 1 AND 128),
 content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
 committed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY (tenant_id,operation_id)
);
CREATE TABLE blueprint_fence_qa.receipt_consumptions (
 tenant_id uuid NOT NULL, operation_id uuid NOT NULL,
 consumed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY (tenant_id,operation_id),
 FOREIGN KEY (tenant_id,operation_id) REFERENCES blueprint_fence_qa.receipts(tenant_id,operation_id)
);
ALTER TABLE blueprint_fence_qa.version_commits OWNER TO blueprint_fence_qa_owner;
ALTER TABLE blueprint_fence_qa.receipt_consumptions OWNER TO blueprint_fence_qa_owner;
ALTER TABLE blueprint_fence_qa.version_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_fence_qa.version_commits FORCE ROW LEVEL SECURITY;
ALTER TABLE blueprint_fence_qa.receipt_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_fence_qa.receipt_consumptions FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_commits ON blueprint_fence_qa.version_commits FOR ALL TO blueprint_fence_qa_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_consumptions ON blueprint_fence_qa.receipt_consumptions FOR ALL TO blueprint_fence_qa_owner USING (true) WITH CHECK (true);
REVOKE ALL ON blueprint_fence_qa.version_commits,blueprint_fence_qa.receipt_consumptions FROM PUBLIC, blueprint_fence_qa_executor;

-- Caller-provided identity is NOT authenticated by this function. Keep EXECUTE denied until
-- trusted backend and authoritative session/membership revocation adapter are integrated.
-- The authorization row is locked before checking the receipt; revocation updates the same row.
CREATE FUNCTION blueprint_fence_qa.consume_receipt(
 p_tenant uuid,p_user uuid,p_session uuid,p_operation uuid,
 p_module text,p_sha256 text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = pg_catalog, blueprint_fence_qa AS $$
DECLARE a blueprint_fence_qa.authorization_state%ROWTYPE;
        r blueprint_fence_qa.receipts%ROWTYPE;
BEGIN
 IF p_tenant IS NULL OR p_user IS NULL OR p_session IS NULL OR p_operation IS NULL
    OR p_module IS NULL OR p_sha256 IS NULL THEN
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
    OR (r.scope='CRITICAL' AND a.role<>'admin') THEN
    RAISE EXCEPTION 'invalid or stale receipt' USING ERRCODE='42501';
 END IF;
 INSERT INTO blueprint_fence_qa.receipt_consumptions(tenant_id,operation_id)
 VALUES(p_tenant,p_operation);
 INSERT INTO blueprint_fence_qa.version_commits(tenant_id,operation_id,module_id,content_sha256)
 VALUES(p_tenant,p_operation,p_module,p_sha256);
END $$;
-- Temporary schema CREATE permission is needed for transferring function ownership.
GRANT CREATE ON SCHEMA blueprint_fence_qa TO blueprint_fence_qa_owner;
ALTER FUNCTION blueprint_fence_qa.consume_receipt(uuid,uuid,uuid,uuid,text,text) OWNER TO blueprint_fence_qa_owner;
REVOKE CREATE ON SCHEMA blueprint_fence_qa FROM blueprint_fence_qa_owner;
REVOKE ALL ON FUNCTION blueprint_fence_qa.consume_receipt(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC, blueprint_fence_qa_executor;
