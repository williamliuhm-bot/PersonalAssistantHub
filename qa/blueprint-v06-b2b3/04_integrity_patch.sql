-- QA-ONLY, disposable PostgreSQL 17 database; apply after 00-03.
-- Tighten the relationship between a consumed approval and committed content.
BEGIN;
ALTER TABLE blueprint_fence_qa.receipts
 ADD CONSTRAINT receipts_content_identity UNIQUE (tenant_id,operation_id,module_id,content_sha256);
ALTER TABLE blueprint_fence_qa.version_commits
 ADD CONSTRAINT commit_receipt_content_match
 FOREIGN KEY (tenant_id,operation_id,module_id,content_sha256)
 REFERENCES blueprint_fence_qa.receipts(tenant_id,operation_id,module_id,content_sha256)
 DEFERRABLE INITIALLY DEFERRED;
CREATE OR REPLACE FUNCTION blueprint_fence_qa.reject_commit_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, blueprint_fence_qa AS $$
BEGIN
 RAISE EXCEPTION 'version commits are immutable' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS version_commits_immutable ON blueprint_fence_qa.version_commits;
CREATE TRIGGER version_commits_immutable BEFORE UPDATE OR DELETE
 ON blueprint_fence_qa.version_commits FOR EACH ROW
 EXECUTE FUNCTION blueprint_fence_qa.reject_commit_mutation();
CREATE OR REPLACE FUNCTION blueprint_fence_qa.reject_consumption_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, blueprint_fence_qa AS $$
BEGIN
 RAISE EXCEPTION 'receipt consumptions are immutable' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS receipt_consumptions_immutable ON blueprint_fence_qa.receipt_consumptions;
CREATE TRIGGER receipt_consumptions_immutable BEFORE UPDATE OR DELETE
 ON blueprint_fence_qa.receipt_consumptions FOR EACH ROW
 EXECUTE FUNCTION blueprint_fence_qa.reject_consumption_mutation();
REVOKE ALL ON FUNCTION blueprint_fence_qa.reject_commit_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION blueprint_fence_qa.reject_consumption_mutation() FROM PUBLIC;
COMMIT;
