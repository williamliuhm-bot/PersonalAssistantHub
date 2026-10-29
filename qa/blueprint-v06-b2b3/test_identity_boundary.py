"""Offline boundary tests. Decoder/authority are fixtures, not live AuthN proof."""
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import hashlib
import os
from pathlib import Path
import sys
import traceback
import unittest
from unittest.mock import patch
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2] /
                       'personal-assistant-hub/integration-service/app'))
from blueprint_identity import (
    BlueprintIdentityBoundary, BlueprintIdentityDenied, CurrentAuthority,
)

NOW = datetime(2026, 10, 29, 4, 0, tzinfo=timezone.utc)
TOKEN = 'synthetic-access-token-not-a-real-JWT'
TENANT = UUID('11111111-1111-4111-8111-111111111111')
USER = UUID('22222222-2222-4222-8222-222222222222')
SESSION = UUID('33333333-3333-4333-8333-333333333333')


class AuthorityFixture:
    def __init__(self, current):
        self.current = current
        self.calls = []
        self.failure = None

    async def resolve_access_token(self, fingerprint):
        self.calls.append(fingerprint)
        if self.failure:
            raise self.failure
        return self.current


class IdentityBoundaryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.claims = {'sub': '7', 'type': 'access',
                       'iat': NOW.timestamp() - 10, 'exp': NOW.timestamp() + 60}
        self.authority = AuthorityFixture(CurrentAuthority(
            hashlib.sha256(TOKEN.encode()).hexdigest(), 7, TENANT, USER, SESSION,
            4, 'admin', NOW, NOW + timedelta(minutes=10), True, True, True, False,
        ))
        self.decoder_calls = []

        def decoder(token):
            self.decoder_calls.append(token)
            return self.claims

        self.decoder = decoder
        self.boundary = BlueprintIdentityBoundary(
            self.decoder, self.authority, enabled=True, clock=lambda: NOW,
        )

    async def authorize(self, **changes):
        target = {'tenant_id': TENANT, 'expected_generation': 4, 'scope': 'NORMAL'}
        target.update(changes)
        return await self.boundary.authorize(TOKEN, **target)

    async def denied(self, code, **changes):
        with self.assertRaises(BlueprintIdentityDenied) as caught:
            await self.authorize(**changes)
        self.assertEqual(str(caught.exception), code)

    async def test_default_off_does_not_touch_dependencies(self):
        self.boundary = BlueprintIdentityBoundary(self.decoder, self.authority)
        await self.denied('feature_disabled')
        self.assertEqual(self.decoder_calls, [])
        self.assertEqual(self.authority.calls, [])

    async def test_environment_flag_requires_exact_one_and_dependencies(self):
        for flag in (None, '', 'true', '0', 'yes'):
            with self.subTest(flag=flag), patch.dict(os.environ, {}, clear=True):
                if flag is not None:
                    os.environ['BLUEPRINT_B2B3_IDENTITY_ENABLED'] = flag
                self.boundary = BlueprintIdentityBoundary.from_environment()
                await self.denied('feature_disabled')
        with patch.dict(os.environ, {'BLUEPRINT_B2B3_IDENTITY_ENABLED': '1'}):
            self.boundary = BlueprintIdentityBoundary.from_environment()
            await self.denied('backend_identity_unavailable')

    async def test_missing_backend_identity(self):
        for decoder, authority in ((None, self.authority), (self.decoder, None)):
            self.boundary = BlueprintIdentityBoundary(decoder, authority, enabled=True)
            await self.denied('backend_identity_unavailable')

    async def test_valid_identity_uses_only_authoritative_uuid_mapping(self):
        self.claims.update(role='viewer', tenant_id='forged', session_id='forged',
                           user_id='forged', generation=999)
        identity = await self.authorize(scope='CRITICAL')
        self.assertEqual((identity.auth_user_id, identity.tenant_id,
                          identity.receipt_user_id, identity.session_id,
                          identity.generation), (7, TENANT, USER, SESSION, 4))
        self.assertEqual(identity.valid_until, NOW + timedelta(seconds=5))
        self.assertNotIn(TOKEN, repr(identity))
        self.assertEqual(self.authority.calls,
                         [hashlib.sha256(TOKEN.encode()).hexdigest()])

    async def test_forged_subject_denied(self):
        self.claims['sub'] = '8'
        await self.denied('identity_binding_failed')

    async def test_tenant_crossing_denied(self):
        await self.denied('tenant_denied', tenant_id=UUID(int=9))

    async def test_expired_access_token_does_not_query_authority(self):
        self.claims['exp'] = NOW.timestamp()
        await self.denied('expired_or_invalid_access_token')
        self.assertEqual(self.authority.calls, [])

    async def test_required_claims_cannot_be_omitted(self):
        for name in ('iat', 'exp', 'sub', 'type'):
            with self.subTest(name=name):
                value = self.claims.pop(name)
                with self.assertRaises(BlueprintIdentityDenied):
                    await self.authorize()
                self.claims[name] = value

    async def test_refresh_token_is_not_access_identity(self):
        self.claims['type'] = 'refresh'
        await self.denied('invalid_access_claims')

    async def test_invalid_subject_types(self):
        for value in (None, 7, True, '0', '07', '-1', '7.0', '７'):
            with self.subTest(value=value):
                self.claims['sub'] = value
                await self.denied('invalid_access_claims')

    async def test_nonfinite_or_invalid_times(self):
        for name, value in (('exp', float('nan')), ('exp', float('inf')),
                            ('exp', True), ('exp', '9999999999'),
                            ('iat', NOW.timestamp()+1), ('exp', 10**1000)):
            with self.subTest(name=name, value=type(value).__name__):
                previous = self.claims[name]
                self.claims[name] = value
                await self.denied('expired_or_invalid_access_token')
                self.claims[name] = previous

    async def test_verifier_errors_are_redacted(self):
        def broken(_):
            raise RuntimeError(TOKEN)
        self.boundary = BlueprintIdentityBoundary(
            broken, self.authority, enabled=True, clock=lambda: NOW)
        await self.denied('token_verification_failed')

    async def test_unverified_or_missing_claims_denied(self):
        for claims in (None, [], {'sub': '7'}):
            self.claims = claims
            await self.denied('invalid_access_claims')

    async def test_live_user_session_membership_and_blacklist(self):
        base = self.authority.current
        for name, value in (('user_active', False), ('session_active', False),
                            ('membership_active', False), ('token_revoked', True),
                            ('membership_active', 'true')):
            with self.subTest(name=name):
                self.authority.current = replace(base, **{name: value})
                await self.denied('revoked_identity')

    async def test_token_fingerprint_is_bound(self):
        for value in ('a'*64, '非ascii', ''):
            self.authority.current = replace(self.authority.current,
                                             token_fingerprint=value)
            await self.denied('identity_binding_failed')

    async def test_integer_user_and_uuid_mapping_are_strict(self):
        base = self.authority.current
        for name, value in (('auth_user_id', True), ('receipt_user_id', 7),
                            ('session_id', UUID(int=0))):
            self.authority.current = replace(base, **{name: value})
            await self.denied('identity_binding_failed')

    async def test_stale_generation_denied(self):
        await self.denied('stale_generation', expected_generation=3)

    async def test_client_role_cannot_elevate_membership(self):
        self.claims['role'] = 'admin'
        self.authority.current = replace(self.authority.current, role='viewer')
        await self.denied('role_denied')

    async def test_approver_cannot_request_critical_scope(self):
        self.authority.current = replace(self.authority.current, role='approver')
        self.assertEqual((await self.authorize()).scope, 'NORMAL')
        await self.denied('role_denied', scope='CRITICAL')

    async def test_stale_future_and_expired_authority(self):
        base = self.authority.current
        for name, value in (('checked_at', NOW-timedelta(seconds=6)),
                            ('checked_at', NOW-timedelta(seconds=5)),
                            ('checked_at', NOW+timedelta(seconds=1)),
                            ('session_expires_at', NOW),
                            ('checked_at', NOW.replace(tzinfo=None))):
            self.authority.current = replace(base, **{name: value})
            await self.denied('stale_or_expired_authority')

    async def test_authority_outage_never_uses_cache(self):
        await self.authorize()
        self.authority.failure = RuntimeError(TOKEN)
        await self.denied('authority_unavailable')
        self.assertEqual(len(self.authority.calls), 2)

    async def test_missing_authority_record_denied(self):
        self.authority.current = None
        await self.denied('backend_identity_unavailable')

    async def test_replayed_revoked_token_rechecks_live_state(self):
        await self.authorize()
        self.authority.current = replace(self.authority.current, token_revoked=True)
        await self.denied('revoked_identity')
        self.assertEqual(len(self.authority.calls), 2)

    async def test_access_expiry_after_authority_await(self):
        times = iter((NOW, NOW+timedelta(minutes=2)))
        self.boundary = BlueprintIdentityBoundary(
            self.decoder, self.authority, enabled=True, clock=lambda: next(times))
        await self.denied('expired_or_invalid_access_token')

    async def test_invalid_target_inputs(self):
        for changes in ({'tenant_id': str(TENANT)}, {'expected_generation': True},
                        {'expected_generation': 0}, {'scope': 'admin'}):
            with self.subTest(changes=changes):
                await self.denied('invalid_target', **changes)

    async def test_malformed_raw_token(self):
        for token in ('', 'a b', 'x'*8193, '非ascii'):
            with self.assertRaisesRegex(BlueprintIdentityDenied, 'invalid_access_token'):
                await self.boundary.authorize(token, tenant_id=TENANT,
                                              expected_generation=4, scope='NORMAL')

    async def test_session_expires_during_authority_await(self):
        # Xiaomi draft, reformatted and reviewed against the actual fixture.
        self.authority.current = replace(
            self.authority.current, session_expires_at=NOW + timedelta(seconds=1))
        times = iter((NOW, NOW + timedelta(seconds=2)))
        self.boundary = BlueprintIdentityBoundary(
            self.decoder, self.authority, enabled=True, clock=lambda: next(times))
        await self.denied('stale_or_expired_authority')

    async def test_authority_freshness_deadline_during_await(self):
        times = iter((NOW, NOW + timedelta(seconds=5)))
        self.boundary = BlueprintIdentityBoundary(
            self.decoder, self.authority, enabled=True, clock=lambda: next(times))
        await self.denied('stale_or_expired_authority')

    async def test_role_downgrade_rechecks_without_stale_jwt_escalation(self):
        self.claims['role'] = 'admin'
        await self.authorize(scope='CRITICAL')
        self.authority.current = replace(self.authority.current, role='approver')
        await self.denied('role_denied', scope='CRITICAL')
        self.assertEqual(len(self.authority.calls), 2)

    async def test_generation_changed_during_lookup(self):
        async def changed_authority(_):
            self.authority.current = replace(self.authority.current, generation=5)
            return self.authority.current
        self.authority.resolve_access_token = changed_authority
        await self.denied('stale_generation')

    async def test_clock_exception_before_or_after_lookup_is_redacted(self):
        for failed_read in (1, 2):
            with self.subTest(failed_read=failed_read):
                reads = 0
                self.authority.calls.clear()
                self.decoder_calls.clear()

                def broken_clock():
                    nonlocal reads
                    reads += 1
                    if reads == failed_read:
                        raise RuntimeError(TOKEN)
                    return NOW

                self.boundary = BlueprintIdentityBoundary(
                    self.decoder, self.authority, enabled=True, clock=broken_clock)
                with self.assertRaises(BlueprintIdentityDenied) as caught:
                    await self.authorize()
                self.assertEqual(str(caught.exception), 'invalid_server_clock')
                self.assertTrue(caught.exception.__suppress_context__)
                self.assertNotIn(TOKEN, ''.join(traceback.format_exception(caught.exception)))
                self.assertEqual(len(self.authority.calls), failed_read - 1)
                self.assertEqual(len(self.decoder_calls), failed_read - 1)

    async def test_invalid_clock_value_before_or_after_lookup(self):
        for invalid in (None, NOW.replace(tzinfo=None)):
            for failed_read in (1, 2):
                with self.subTest(value=invalid, failed_read=failed_read):
                    values = (invalid, NOW) if failed_read == 1 else (NOW, invalid)
                    times = iter(values)
                    self.boundary = BlueprintIdentityBoundary(
                        self.decoder, self.authority, enabled=True,
                        clock=lambda: next(times))
                    await self.denied('invalid_server_clock')

    async def test_clock_regression_after_lookup_is_denied(self):
        times = iter((NOW, NOW - timedelta(microseconds=1)))
        self.boundary = BlueprintIdentityBoundary(
            self.decoder, self.authority, enabled=True, clock=lambda: next(times))
        await self.denied('invalid_server_clock')

    async def test_unrepresentable_finite_expiry_is_denied(self):
        self.claims['exp'] = 1e20
        await self.denied('expired_or_invalid_access_token')


if __name__ == '__main__':
    unittest.main()
