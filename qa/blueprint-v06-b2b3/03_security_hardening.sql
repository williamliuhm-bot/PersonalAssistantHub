-- ISOLATED QA CANDIDATE ONLY. Apply after 00,01,02 to a NEW disposable database.
-- Blocks tampering with immutable receipt claims, prevents renewal by timestamp edits,
-- and ensures a committed version cannot diverge from its bound receipt.
BEGIN;
CREATE OR REPLACE FUNCTION blueprint_fence_qa.reject_receipt_claim_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, blueprint_fence_qa AS $$
BEGIN
 IF ROW(NEW.tenant_id,NEW.operation_id,NEW.user_id,NEW.session_id,
        NEW.generation,NEW.scope,NEW.issued_at,NEW.expires_at,
        NEW.module_id,NEW.content_sha256)
    IS DISTINCT FROM
    ROW(OLD.tenant_id,OLD.operation_id,OLD.user_id,OLD.session_id,
        OLD.generation,OLD.scope,OLD.issued_at,OLD.expires_at,
        OLD.module_id,OLD.content_sha256) THEN
   RAISE EXCEPTION 'receipt claims are immutable' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS receipt_claims_immutable ON blueprint_fence_qa.receipts;
CREATE TRIGGER receipt_claims_immutable BEFORE UPDATE ON blueprint_fence_qa.receipts
FOR EACH ROW EXECUTE FUNCTION blueprint_fence_qa.reject_receipt_claim_changes();

-- Defense in depth: a QA version row cannot be created without a matching
-- consumed receipt; this does not replace controlled function privileges.
ALTER TABLE blueprint_fence_qa.version_commits
 ADD CONSTRAINT commit_requires_consumption FOREIGN KEY (tenant_id,operation_id)
 REFERENCES blueprint_fence_qa.receipt_consumptions(tenant_id,operation_id)
 DEFERRABLE INITIALLY DEFERRED;

-- Keep all privileged functions inaccessible from untrusted roles.
REVOKE ALL ON FUNCTION blueprint_fence_qa.reject_receipt_claim_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION blueprint_fence_qa.issue_receipt(uuid,uuid,uuid,uuid,text,bigint,text,text) FROM PUBLIC, blueprint_fence_qa_executor;
REVOKE ALL ON FUNCTION blueprint_fence_qa.consume_receipt(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC, blueprint_fence_qa_executor;
REVOKE ALL ON FUNCTION blueprint_fence_qa.revoke_authorization(uuid,uuid,uuid,boolean,boolean,text) FROM PUBLIC, blueprint_fence_qa_executor;
COMMIT;
