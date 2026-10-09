# Provider evidence and safe retry handling

Official sources checked on 2026-10-08. Mappings are deliberately conservative; validate new codes against current docs before extending rules.

## Runway

[Task failures](https://docs.dev.runwayml.com/errors/task-failures/)

Safety and invalid-asset failures should not be retried unchanged. Internal and upstream failures may warrant delayed retry. Bad-output failures require reviewing the request/output context, not a blind loop. The implementation distinguishes these families without reproducing user prompts.

## fal

[Model and request errors](https://fal.ai/docs/documentation/model-apis/errors)

Prefer machine-readable `type` / `error_type`, not human-readable `msg`. Observe `X-Fal-Needs-Retry`; absence does not authorize retry, and false blocks unchanged retry. Model input errors differ from infrastructure errors. Several infrastructure codes can be retryable or non-retryable depending on context. Do not assume HTTP 500 always means retry.

## Replicate

[Prediction lifecycle overview](https://replicate.com/docs/reference/how-does-replicate-work/)

Starting and processing are normal nonterminal states. A failed prediction with no recognized error remains undiagnosed. A supplied elapsed-time budget can establish a local deadline overrun, not a provider failure. Read the original prediction status before creating a replacement.

## ComfyUI

[Official troubleshooting](https://docs.comfy.org/troubleshooting/overview)

Tracebacks, environment details, custom-node information, workflow and recent changes support diagnosis. OOM is a symptom: confirm the failing operation and memory context. Model-specific tiled VAE/offloading availability must be checked. A before/after version change alone is not proof of a regression. Avoid copying random troubleshooting install commands into an automatic repair step.

## Cross-provider policy (our conservative policy, not a provider promise)

- 401/403/402: review auth, access or billing without disclosing secrets.
- 429: check hard quota versus temporary rate limits; honor documented delays.
- 400/422: inspect input; do not declare schema drift without comparison evidence.
- 5xx or a lost response: reconcile the original task first; never infer that no billable job exists.
- Conflicting failure signals: the strongest no-retry restriction wins; investigate chronology.
- Each finding's `retry` is effective advice for this incident, restricted by the overall decision. It is not standalone permission to retry that symptom; evidence/category ordering is retained before applying these restrictions.
- A provider's retry permission is not the user's spending approval. Set an explicit attempt/cost cap before any actual retry, outside this CLI.

FFmpeg signatures are local text heuristics, not a complete parser. Verify codec/build/output settings before changing them. Encoding and webhook failures should reuse completed generation artifacts where possible.
