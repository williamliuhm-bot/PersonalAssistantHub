"""New offline draft-contract cases; no existing identity or PG17 suite runs."""
from dataclasses import replace
import hashlib
import unittest
from uuid import UUID

from publication_contract import (
    MAX_I64, MAX_SPEC_BYTES, PublicationContractError, PublicationIntent,
    RecoveryMatch, StoredPublicationResult, bound_claims, compare_recovery,
    intent_sha256,
)


class PublicationContractTests(unittest.TestCase):
    def setUp(self):
        # References are synthetic metadata, not proof of an approved decision.
        self.intent = PublicationIntent(
            UUID(int=1), UUID(int=2), UUID(int=3), UUID(int=4), 1, 'NORMAL',
            'blueprint-center', 'DRAFT', 0, b'{"name":"draft"}',
            parent_version_id=UUID(int=5), decision_ref='synthetic-review',
            code_commit_sha='a'*40,
        )

    def rejected(self, code, **changes):
        with self.assertRaisesRegex(PublicationContractError, '^'+code+'$'):
            bound_claims(replace(self.intent, **changes))

    def test_exact_snapshot_content_hash(self):
        claims = bound_claims(self.intent)
        self.assertEqual(claims['content_sha256'],
                         hashlib.sha256(self.intent.spec_json).hexdigest())
        self.assertNotIn('spec_json', claims)
        self.assertNotIn('name', repr(self.intent))

    def test_version_kind_changes_intent_digest(self):
        # Xiaomi draft, reviewed against actual stage validation and fixtures.
        approved = replace(self.intent, version_kind='APPROVED_DESIGN')
        self.assertEqual(self.intent.spec_json, approved.spec_json)
        self.assertNotEqual(intent_sha256(self.intent), intent_sha256(approved))

    def test_identity_operation_generation_and_scope_are_bound(self):
        for field, value in (('tenant_id', UUID(int=9)), ('operation_id', UUID(int=9)),
                             ('receipt_user_id', UUID(int=9)), ('session_id', UUID(int=9)),
                             ('generation', 2), ('scope', 'CRITICAL')):
            with self.subTest(field=field):
                self.assertNotEqual(intent_sha256(self.intent),
                                    intent_sha256(replace(self.intent, **{field: value})))

    def test_publication_metadata_is_bound(self):
        for field, value in (('module_id', 'another-module'), ('expected_revision', 1),
                             ('parent_version_id', UUID(int=9)), ('decision_ref', 'different'),
                             ('code_commit_sha', 'b'*40)):
            with self.subTest(field=field):
                self.assertNotEqual(intent_sha256(self.intent),
                                    intent_sha256(replace(self.intent, **{field: value})))

    def test_snapshot_bytes_are_not_silently_normalized(self):
        changed = replace(self.intent, spec_json=b'{ "name": "draft" }')
        self.assertNotEqual(bound_claims(self.intent)['content_sha256'],
                            bound_claims(changed)['content_sha256'])
        self.assertNotEqual(intent_sha256(self.intent), intent_sha256(changed))

    def test_non_object_or_invalid_json_is_rejected(self):
        for raw in (b'[]', b'null', b'true', b'"text"', b'{broken'):
            with self.subTest(raw=raw):
                self.rejected('invalid_spec_json', spec_json=raw)

    def test_duplicate_keys_are_rejected_including_nested_and_escaped_keys(self):
        for raw in (b'{"x":1,"x":2}', b'{"x":{"y":1,"y":2}}',
                    b'{"a":1,"\\u0061":2}'):
            with self.subTest(raw=raw):
                self.rejected('invalid_spec_json', spec_json=raw)

    def test_invalid_numeric_constants_are_rejected(self):
        for raw in (b'{"x":NaN}', b'{"x":Infinity}', b'{"x":-Infinity}',
                    b'{"x":1e999999999999999999999999999999999}'):
            with self.subTest(raw=raw):
                self.rejected('invalid_spec_json', spec_json=raw)

    def test_invalid_utf8_and_surrogate_strings_are_rejected(self):
        for raw in (b'{"x":"\xff"}', b'{"x":"\\ud800"}', b'{"\\ud800":1}'):
            with self.subTest(raw=raw):
                self.rejected('invalid_spec_json', spec_json=raw)

    def test_excessive_depth_is_rejected(self):
        raw = b'{"x":' + b'['*65 + b'0' + b']'*65 + b'}'
        self.rejected('invalid_spec_json', spec_json=raw)

    def test_snapshot_type_and_size_are_bounded(self):
        for raw in ('{}', bytearray(b'{}'), b'', b' '*(MAX_SPEC_BYTES+1)):
            with self.subTest(kind=type(raw).__name__):
                self.rejected('invalid_spec_json', spec_json=raw)

    def test_nil_and_untyped_identity_bindings_are_rejected(self):
        for field in ('tenant_id', 'operation_id', 'receipt_user_id', 'session_id'):
            for value in (UUID(int=0), 'caller-id', True):
                with self.subTest(field=field, value=value):
                    self.rejected('invalid_identity_binding', **{field: value})

    def test_generation_and_revision_do_not_overflow_or_accept_boolean(self):
        for field, value in (('generation', 0), ('generation', True),
                             ('generation', MAX_I64), ('expected_revision', -1),
                             ('expected_revision', True), ('expected_revision', MAX_I64)):
            with self.subTest(field=field, value=value):
                self.rejected('invalid_revision_or_generation', **{field: value})

    def test_kind_scope_and_module_are_validated(self):
        self.rejected('invalid_kind_or_scope', scope='admin')
        self.rejected('invalid_kind_or_scope', version_kind='PUBLISHED')
        for module in ('', 'Uppercase', 'with/slash', 'a'*129, 'module\x00'):
            self.rejected('invalid_module', module_id=module)

    def test_non_draft_stages_require_references(self):
        for kind in ('APPROVED_DESIGN', 'IMPLEMENTED_RELEASE'):
            for field in ('parent_version_id', 'decision_ref'):
                self.rejected('missing_stage_references', version_kind=kind, **{field: None})
        self.rejected('missing_stage_references', version_kind='IMPLEMENTED_RELEASE',
                      code_commit_sha=None)

    def test_optional_references_cannot_contain_ambiguous_values(self):
        self.rejected('invalid_parent', parent_version_id='client-reference')
        for ref in ('', 'bad\nref', '\ud800', 'a'*513):
            self.rejected('invalid_decision_ref', decision_ref=ref)
        for commit in ('A'*40, 'short', True):
            self.rejected('invalid_code_commit', code_commit_sha=commit)

    def test_exact_recovery_is_equality_only(self):
        stored = StoredPublicationResult(self.intent.tenant_id, self.intent.operation_id,
                                         intent_sha256(self.intent), UUID(int=8))
        self.assertEqual(compare_recovery(self.intent, stored), RecoveryMatch.EXACT)
        self.assertNotIsInstance(compare_recovery(self.intent, stored), UUID)

    def test_missing_result_is_unknown_not_retry_permission(self):
        self.assertEqual(compare_recovery(self.intent, None), RecoveryMatch.UNKNOWN)

    def test_cross_binding_recovery_conflicts(self):
        stored = StoredPublicationResult(self.intent.tenant_id, self.intent.operation_id,
                                         intent_sha256(self.intent), UUID(int=8))
        for field, value in (('tenant_id', UUID(int=9)), ('operation_id', UUID(int=9)),
                             ('generation', 2), ('version_kind', 'APPROVED_DESIGN'),
                             ('spec_json', b'{"name":"changed"}')):
            with self.subTest(field=field):
                self.assertEqual(compare_recovery(replace(self.intent, **{field: value}), stored),
                                 RecoveryMatch.CONFLICT)

    def test_malformed_stored_result_is_not_a_committed_proof(self):
        stored = StoredPublicationResult(self.intent.tenant_id, self.intent.operation_id,
                                         intent_sha256(self.intent), UUID(int=8))
        for value in ({'verifiedByServer': True}, replace(stored, version_id=UUID(int=0)),
                      replace(stored, intent_sha256='not-a-hash')):
            with self.assertRaisesRegex(PublicationContractError, '^invalid_stored_result$'):
                compare_recovery(self.intent, value)


if __name__ == '__main__':
    unittest.main()
