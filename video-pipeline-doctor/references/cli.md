# CLI and input contract

Run from the skill folder, or use the absolute script path. Commands are implemented now, not proposals:

```sh
node scripts/cli.mjs diagnose --log error.log --provider comfyui --workflow workflow.json --context context.json --json
node scripts/cli.mjs diagnose --response response.json --provider runway
node scripts/cli.mjs diagnose --incident examples/comfyui-oom.json --json
node scripts/cli.mjs diagnose --stdin --provider ffmpeg
```

`--stdin` reads plain log text until EOF. `--json` outputs only diagnosis JSON to stdout. Human-readable output is the default. `--incident` accepts the combined object below and cannot be combined with other input options. Do not claim `npx video-doctor` is available: no npm package has been published.

```json
{
  "provider": "comfyui",
  "log": "CUDA out of memory",
  "response": { "type": "execution_error", "data": { "node_id": "2", "exception_message": "CUDA out of memory" } },
  "workflow": {
    "1": { "class_type": "LoadImage", "inputs": {} },
    "2": { "class_type": "VAEEncode", "inputs": { "pixels": ["1", 0] } }
  },
  "context": { "failing_node_id": "2" }
}
```

## Supported data

- Provider: `auto` (default), `comfyui`, `runway`, `fal`, `replicate`, `ffmpeg`, `unknown`. Detection is best effort; supply an explicit provider for ambiguous logs. Workflow presence identifies ComfyUI context, not the failing remote provider.
- Response: raw provider object, or `{ "http_status": 503, "headers": {}, "body": {...} }`. An HTTP status must be an integer, separate from the job's string status. Only known fields are examined. fal typed errors require `--provider fal` unless a fal documentation URL or queue envelope establishes provenance.
- Runway: `failureCode`, `status`, `failure`.
- fal: `detail[].type`, `error_type`, `status`, `X-Fal-Needs-Retry` header. Unknown typed model validation errors remain non-retryable; raw `msg`/`input` are not echoed or parsed for categorization.
- Replicate: `status`, `error`, `logs`; automatic detection requires `version` with `model` or `logs`. Unrecognized errors are unknown. `starting`/`processing` do not imply timeout.
- ComfyUI: `execution_error.data.node_id/exception_message`, or flat equivalents. UI workflow `nodes` + legacy array-form `links`, and API prompt dictionaries (optionally under `prompt`) are supported. Numeric node IDs only; arbitrary titles/widgets never appear in the report. New object-form links and subgraph formats are currently unsupported, reported INVALID.
- Context: `failing_node_id`; optional nonnegative `elapsed_seconds` and positive `deadline_seconds` (a caller-defined deadline); `schema_change_confirmed: true` is a caller assertion, not independent verification. Other metadata is not interpreted by the CLI; the host agent can review approved redacted metadata separately.

One incident per invocation. Do not mix unrelated jobs or historical runs. Source locations in reports are normalized field/line pointers, not verbatim excerpts.

## Bounds and exits

Each local file or stdin is limited to 2 MiB. Combined scanned log text is limited to 2 MiB. Workflows are limited to 10,000 nodes / 50,000 edges; fal details to 1,000 entries. No glob/directory scan, remote URL fetching, subprocess, write, or environment inventory.

- `0`: at least one finding (not a success/health check).
- `2`: insufficient diagnostic evidence, including a completed status without failure evidence.
- `64`: argument/read/JSON/input error; sanitized diagnostic on stderr.

No persistent storage. If a user chooses shell redirection, its destination and retention are their responsibility. Logs can contain private content; use redacted copies even though the CLI itself stays offline.
