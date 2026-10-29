# I01-E3 contract review and bounded follow-up

2026-10-29 HKT. Reviewed `I01-E3-IDENTITY-CONTRACT-PROPOSAL.md` at QA HEAD `ea8eff87f5d41c735d682546b74e36a3f10c0266`, latest enabled Working Rules and actual Auth/Receipt source. **REVIEWED PROPOSAL, NOT SCHEMA/AUTH/PERMISSION APPROVAL.** No DDL, role/grant, provider binding, Login change or deployment.

## Review conclusions

1. **Retain the default-OFF boundary and authoritative mapping requirement.** Existing integer Auth user IDs do not establish tenant, receipt-user UUID, durable session or generation. No default tenant, role translation or legacy-token enrollment can be selected implicitly. The I01-E2 34/34 offline result remains valid evidence for that tested boundary only and was not rerun.
2. **The async resolver is necessary but not sufficient.** Existing Auth checks Redis with a raw-token key; the fingerprint-only provider cannot perform that lookup. A server-owned async resolver using existing configured Auth facilities remains the recommended direction, subject to C2 approval and the Login pause. It does not serialize Redis revocation with publication. Do not pass client `verifiedByServer` flags or stored raw tokens as a workaround.
3. **Clarify revocation granularity before implementation.** Proposed conservative policy: revoking an account/membership invalidates all affected sessions; revoking a session invalidates its approvals; role changes update affected fence rows. A single access-token revocation marks that binding revoked and bumps its session fence, invalidating all pending receipts for that session, including receipts associated with other still-valid access tokens. Those other tokens may request new receipts only after fresh authority resolution at the new generation. This collateral invalidation is an explicit proposal, not an approved policy.
4. **Do not relabel Redis a mirror for the whole application.** Current legacy Auth routes still rely on it. A successful SQL fence update with a failed Redis update can establish only a B2/B3 fence outcome, not globally completed Auth revocation. Unknown/partial cross-store acknowledgments must remain explicit and B2/B3 must fail closed. Choosing a global acknowledgment/reconciliation policy requires the Auth owner; no dual-write atomicity is assumed.
5. **Align one lock order with I02.** Proposed order for all future writers: membership → session/fence → module head → receipt/operation → immutable version/result. Receipt rows already reserve `(tenant, operation_id)` in the existing QA contract. Membership mutation/enrollment and publishers must use the same lock protocol. Cross-database or separately committed callbacks do not implement it.
6. **Separate content hash from full-intent hash.** Existing QA receipts bind module + `content_sha256`; they do not bind version kind, expected module revision, parent or immutable decision/code references. I02 must add an independently reviewed intent binding rather than silently redefine the existing content hash. The QA-only `publication_contract.py` exercises a draft profile; it does not change or connect to Receipt SQL.
7. **Recovery is a read decision, not renewed consumption.** A previously committed exact operation may be recoverable after its original receipt expires, subject to fresh current authorization and the approved generation policy. It must return the existing version, not consume again or renew timestamps. Changed scope/identity/generation/metadata conflicts or is denied. A missing result without transaction/lock evidence remains UNKNOWN, not permission to retry an external call.
8. **Decisions must be immutable, server-resolved references.** A decision_ref string or code SHA passing syntax checks does not prove approval, Git existence, a parent relationship, runtime verification or deployment. Approved stages must resolve a version-addressed decision/evidence reference under the approved source policy. The draft helper intentionally cannot perform that live verification.

## Small tasks and outcomes

These are documentation labels, not invented Codex Tracker IDs.

| Task | Scope | Actual outcome |
|---|---|---|
| CR-01 | Review source-backed E3 assumptions and contradictions | COMPLETE as analysis; eight conclusions above |
| QA-P01 | Pure QA intent binding and recovery-equality helper | IMPLEMENTED; no database writes/receipts/auth |
| QA-P02 | One Xiaomi-written version-kind digest test | IMPLEMENTED and passed in the first new-test run |
| QA-P03 | Repair actual JSON numeric-parser failure | FIXED; only the failed test method rerun |
| DES-01 | Version-table/atomic-publication design | REVIEWABLE PROPOSAL in I02 document; schema approval pending |
| DES-02 | Privilege/lock/revocation and recovery constraints | PROPOSED, not applied |
| BIND-01 | Genuine async Auth/session/membership resolver | BLOCKED C1/C2 and authoritative store decision |
| PUB-01 | Real publisher/receipt/version adapter | BLOCKED C3 and intent/schema/permissions approval |
| HOST-01 | Hosted execution | BLOCKED C4; no resource probes or provisioning |

## Decisions still requiring owner review

- **C1:** authoritative tenant/membership owner and explicit tenant-scoped Auth-role policy.
- **C2:** session/enrollment, async verifier and cross-store revocation contract, including session-wide receipt fencing for a single-token revocation and the Login pause.
- **C3:** the I02 version store, exact snapshot/intent representation, same-database transaction and least-privilege facade proposal.
- **C4:** an existing isolated hosted resource's ownership, TLS, PG compatibility and quotas before any hosted test.

The review narrows these decisions; it does not approve them. There is still no genuine AuthN/provider/publication/Hosted E2E result. Keep Phase 9 OFF, CX-174 BLOCKED and Release Gate LOCAL_REVIEW_READY. No already-passed identity or PG17 tests were rerun in this batch.
