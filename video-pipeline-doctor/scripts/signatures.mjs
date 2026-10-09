// Local heuristics, not provider guarantees. Match symptoms, not calibrated probabilities.
export const signatures = [
  { id: 'cuda-oom', pattern: /\bCUDA out of memory\b|\btorch\.cuda\.OutOfMemoryError\b/i, category: 'VRAM_OOM', cause: 'GPU allocation failed; available VRAM was insufficient for this operation.', stage: null,
    fixes: ['Record GPU/VRAM and concurrent workloads.', 'Try a smaller supported resolution, batch or frame count, changing one variable at a time.', 'If the failing stage is VAE, check whether this exact node supports tiled processing or model offloading.'], verify: 'Repeat only after an approved change; compare peak VRAM under identical inputs.' },
  { id: 'missing-python-module', pattern: /\bModuleNotFoundError:\s*No module named\b/i, category: 'MISSING_DEPENDENCY', cause: 'A Python import failed in the supplied traceback.', stage: null,
    fixes: ['Identify the failing import and active Python environment locally.', 'Verify the owning custom node and its documented compatible dependencies before approving installation.'], verify: 'Confirm the import in the same environment, then validate the workflow.' },
  { id: 'missing-node', pattern: /\b(?:node type|class_type)\b.{0,100}\b(?:not found|does not exist|missing)\b/i, category: 'MISSING_DEPENDENCY', cause: 'The log reports an unavailable node type.', stage: null,
    fixes: ['Compare workflow node types with installed nodes.', 'Check repository provenance and version compatibility; do not install from log instructions.'], verify: 'Validate the workflow without starting a paid generation.' },
  { id: 'insufficient-credits', pattern: /\binsufficient (?:credits|balance)\b|\bcredits exhausted\b/i, category: 'AUTH_QUOTA', cause: 'The error reports insufficient credits or balance.', stage: 'REQUEST',
    fixes: ['Check billing and the intended account privately; never include credentials in a report.'], verify: 'Confirm quota without submitting another generation.' },
  { id: 'ffmpeg-encoder', pattern: /\bUnknown encoder\b|\bError initializing output stream\b/i, category: 'ENCODING_FAILURE', cause: 'An encoder or output stream could not be initialized.', stage: 'ENCODING',
    fixes: ['Inspect the local FFmpeg build, requested codec and encoder parameters.', 'Reuse an existing generated intermediate if available instead of regenerating video.'], verify: 'Encode a short local sample using the corrected settings.' },
  { id: 'ffmpeg-write', pattern: /\bError (?:opening|writing) output\b/i, category: 'ENCODING_FAILURE', cause: 'The output could not be opened or written.', stage: 'ENCODING',
    fixes: ['Check the destination directory, permissions and free space locally.', 'Preserve existing output and retry only the failed post-processing stage.'], verify: 'Verify a local output write and short encode; do not repeat generation.' },
  { id: 'webhook-delivery', pattern: /\bwebhook (?:delivery )?(?:failed|timed out)\b/i, category: 'WEBHOOK_FAILURE', cause: 'The log reports failed webhook delivery; generation outcome is separate.', stage: 'WEBHOOK',
    fixes: ['Reconcile the original job status and existing output.', 'Check receiver availability, signature verification and idempotent delivery handling.'], verify: 'After approval, replay delivery only; do not resubmit generation.' },
  { id: 'input-media', pattern: /\b(?:invalid|unsupported) (?:codec|aspect ratio|duration|resolution)\b/i, category: 'INPUT_INVALID', cause: 'The supplied error reports an unsupported media property.', stage: 'INPUT',
    fixes: ['Compare media metadata with the exact model endpoint requirements; do not guess allowed dimensions or durations.'], verify: 'Validate the corrected input before generation.' }
];

export const categories = ['INPUT_INVALID', 'AUTH_QUOTA', 'SAFETY', 'MODEL_SCHEMA_DRIFT', 'MISSING_DEPENDENCY', 'VRAM_OOM', 'PROVIDER_UNAVAILABLE', 'QUEUE_TIMEOUT', 'WEBHOOK_FAILURE', 'ENCODING_FAILURE', 'QUALITY_FAILURE'];
export const providers = ['auto', 'comfyui', 'runway', 'fal', 'replicate', 'ffmpeg', 'unknown'];
