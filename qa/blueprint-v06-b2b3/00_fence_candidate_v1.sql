-- ISOLATED QA CANDIDATE ONLY. Never apply to PA Hub Production.
-- Preconditions: trusted server owns the dedicated LOGIN role; never expose to client.
-- External Supabase Auth revocation is NOT serialized by this database fence.
CREATE SCHEMA IF NOT EXISTS blueprint_fence_qa;
REVOKE ALL ON SCHEMA blueprint_fence_qa FROM PUBLIC;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='blueprint_fence_qa_owner') THEN
    CREATE ROLE blueprint_fence_qa_owner NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='blueprint_fence_qa_executor') THEN
    CREATE ROLE blueprint_fence_qa_executor NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE, CREATE ON SCHEMA blueprint_fence_qa TO blueprint_fence_qa_owner;
GRANT USAGE ON SCHEMA blueprint_fence_qa TO blueprint_fence_qa_executor;

CREATE TABLE blueprint_fence_qa.authorization_state (
 tenant_id uuid NOT NULL, user_id uuid NOT NULL, session_id uuid NOT NULL,
 generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0),
 active_session boolean NOT NULL, active_membership boolean NOT NULL,
 role text NOT NULL CHECK (role IN ('viewer','approver','admin')),
 PRIMARY KEY (tenant_id,user_id,session_id)
);
CREATE TABLE blueprint_fence_qa.receipts (
 tenant_id uuid NOT NULL, operation_id uuid NOT NULL, user_id uuid NOT NULL,
 session_id uuid NOT NULL, generation bigint NOT NULL,
 scope text NOT NULL CHECK (scope IN ('NORMAL','CRITICAL')),
 issued_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY (tenant_id,operation_id)
);
ALTER TABLE blueprint_fence_qa.authorization_state OWNER TO blueprint_fence_qa_owner;
ALTER TABLE blueprint_fence_qa.receipts OWNER TO blueprint_fence_qa_owner;
ALTER TABLE blueprint_fence_qa.authorization_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_fence_qa.authorization_state FORCE ROW LEVEL SECURITY;
ALTER TABLE blueprint_fence_qa.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_fence_qa.receipts FORCE ROW LEVEL SECURITY;
-- Policies apply only to the dedicated table owner. Executor gets no table privileges.
CREATE POLICY owner_state ON blueprint_fence_qa.authorization_state
 FOR ALL TO blueprint_fence_qa_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_receipts ON blueprint_fence_qa.receipts
 FOR ALL TO blueprint_fence_qa_owner USING (true) WITH CHECK (true);
REVOKE ALL ON ALL TABLES IN SCHEMA blueprint_fence_qa FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA blueprint_fence_qa FROM blueprint_fence_qa_executor;

-- The trusted service must verify actual Auth/session status before calling this function.
-- It MUST also update authoritative revocation state using revoke_authorization below.
-- Function inputs are NOT proof of identity; restrict executor membership to trusted backend.
CREATE FUNCTION blueprint_fence_qa.issue_receipt(
 p_tenant uuid, p_user uuid, p_session uuid, p_operation uuid,
 p_scope text, p_expected_generation bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = pg_catalog, blueprint_fence_qa AS $$
DECLARE a blueprint_fence_qa.authorization_state%ROWTYPE;
BEGIN
 IF p_scope NOT IN ('NORMAL','CRITICAL') OR p_expected_generation IS NULL THEN
   RAISE EXCEPTION 'invalid request' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM blueprint_fence_qa.authorization_state
 WHERE tenant_id=p_tenant AND user_id=p_user AND session_id=p_session FOR UPDATE;
 IF NOT FOUND OR a.generation<>p_expected_generation OR NOT a.active_session
    OR NOT a.active_membership OR a.role NOT IN ('approver','admin')
    OR (p_scope='CRITICAL' AND a.role<>'admin') THEN
   RAISE EXCEPTION 'stale or revoked authorization' USING ERRCODE='42501';
 END IF;
 INSERT INTO blueprint_fence_qa.receipts
 (tenant_id,operation_id,user_id,session_id,generation,scope)
 VALUES(p_tenant,p_operation,p_user,p_session,p_expected_generation,p_scope);
END $$;
ALTER FUNCTION blueprint_fence_qa.issue_receipt(uuid,uuid,uuid,uuid,text,bigint)
 OWNER TO blueprint_fence_qa_owner;
REVOKE ALL ON FUNCTION blueprint_fence_qa.issue_receipt(uuid,uuid,uuid,uuid,text,bigint) FROM PUBLIC;
-- DELIBERATELY NO EXECUTE GRANT UNTIL TRUSTED BACKEND AUTH IS INTEGRATED.

CREATE FUNCTION blueprint_fence_qa.revoke_authorization(
 p_tenant uuid,p_user uuid,p_session uuid,
 p_active_session boolean,p_active_membership boolean,p_role text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = pg_catalog, blueprint_fence_qa AS $$
BEGIN
 UPDATE blueprint_fence_qa.authorization_state
 SET active_session=p_active_session,active_membership=p_active_membership,
     role=p_role,generation=generation+1
 WHERE tenant_id=p_tenant AND user_id=p_user AND session_id=p_session;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing authorization' USING ERRCODE='42501'; END IF;
END $$;
ALTER FUNCTION blueprint_fence_qa.revoke_authorization(uuid,uuid,uuid,boolean,boolean,text)
 OWNER TO blueprint_fence_qa_owner;
REVOKE ALL ON FUNCTION blueprint_fence_qa.revoke_authorization(uuid,uuid,uuid,boolean,boolean,text) FROM PUBLIC;
-- DELIBERATELY NO EXECUTE GRANT: trusted revocation adapter not yet implemented.
REVOKE CREATE ON SCHEMA blueprint_fence_qa FROM blueprint_fence_qa_owner;
