# Failure taxonomy and evidence

| Category | What v0.1 can establish | Important limit |
|---|---|---|
| INPUT_INVALID | HTTP rejection, typed provider input error, media signature | Exact acceptable dimensions depend on endpoint |
| AUTH_QUOTA | HTTP auth/billing/rate rejection, credit signature | 429 alone does not distinguish hard quota |
| SAFETY | Recognized provider moderation code | No evasion or unchanged retries |
| MODEL_SCHEMA_DRIFT | Validation failure plus caller-confirmed schema change | Caller assertion; inspect the actual schema diff |
| MISSING_DEPENDENCY | Import or missing-node signature | Does not install or inspect installed packages |
| VRAM_OOM | CUDA OOM signature | Allocation symptom, not a measured memory budget |
| PROVIDER_UNAVAILABLE | HTTP/server or known provider failure | Not proof of a platform-wide outage |
| QUEUE_TIMEOUT | Explicit provider timeout, or caller deadline overrun | Pending alone is not a timeout |
| WEBHOOK_FAILURE | Delivery failure signature | Does not imply generation failed |
| ENCODING_FAILURE | FFmpeg encoding/output error signature | Local permissions/disk state not inspected |
| QUALITY_FAILURE | Runway bad-output code | No automatic visual-quality evaluation |
| UNKNOWN | Unrecognized cause or client interruption | Must remain uncertain |

`confidence` is `strong` for structured observations and `moderate` for text signatures/caller assertions. This describes evidence for the observation, **not** the probability that a proposed root cause is correct. A numeric percentage would require calibration on labeled incidents.

`stage` remains null unless a signature/code supports it. Recognized VAE/KSampler classes can locate a ComfyUI OOM when the error ID matches the supplied workflow. Neighbor lists are one-hop, not a full execution trace. Graph membership does not prove execution order or dependency availability.

The signature database is `scripts/signatures.mjs`. Extend only using redacted reproducible incidents and tests. Include evidence provenance, counterexamples, retry policy and a verification step. Never embed client logs, credentials, paid assets, arbitrary third-party commands or unverified issue/regression claims.
