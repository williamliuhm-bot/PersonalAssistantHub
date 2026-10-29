# B2/B3 verified Git blob audit (2026-10-29)
Source: PA_Hub_B2B3_PG17_QA_20checks_Local.zip
ZIP SHA256: f869d7689a0a1699768d961a6814a94305edf1a254d492f46697e370329f86ec
Comparison: exact Git blob SHA-1, fetched from GitHub QA branch vs computed from original ZIP bytes.

| File | Original blob SHA | GitHub blob SHA | Result |
| --- | --- | --- | --- |
| 00_fence_candidate_v1.sql | 79d20fa31ded27b9ae9adbbf6f9f7048a9575fc8 | 79d20fa31ded27b9ae9adbbf6f9f7048a9575fc8 | MATCH |
| 01_consumption_extension.sql | da48f6985d68191f2a68951f4ec7740b6554d31b | da48f6985d68191f2a68951f4ec7740b6554d31b | MATCH |
| 05_wall_clock_expiry.sql | 51c92aa3283d6507eade72b1ab949d85103f0b0e | 51c92aa3283d6507eade72b1ab949d85103f0b0e | MATCH |
| 03_security_hardening.sql | 4d3c9650c54de5658d978f94193a684f498121a3 | 6ec1ac3dd156fc02f0e1738d149b282f2b407893 | MISMATCH |
| 04_integrity_patch.sql | fe73dfa0d6513f127d63b908bae4a2e25de16e29 | bbe525e89dc5cbe57df0f751d8c3c690a2f51239 | MISMATCH |
| run_batch.sh | 5b52b3c9fdf59b22ecbb5da9f383c9a5903f8288 | d6bbf193ae8872729f644c9a7d062b1d60b10f87 | CHANGED (post-source safety runner; needs independent validation) |

Do not run migration or claim PG17 runtime PASS. Remaining source files are not all transferred. 02_receipt_content_binding.sql was rejected by the GitHub tool safety check; do not bypass it. Keep QA branch only, no merge/deploy/Production changes. Phase 9 OFF; CX-174 BLOCKED.
