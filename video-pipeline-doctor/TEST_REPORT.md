# v0.1 local validation

## Latest correction validation — 2026-10-09

Fixed the five acceptance failures A13–A17. Added eight standard regression tests covering the failed inputs and neighboring cases; verified these tests expose the old behavior before changing the implementation.

- `node --test tests/*.test.mjs`: **54 passed / 0 failed**.
- `node tests/acceptance-audit.mjs`: **17 passed / 0 failed**, exit 0. The original acceptance expectations were not relaxed or changed.
- Total: **71 passed / 0 failed** (synthetic offline cases, not 71 production incidents).
- Conditional advice following a real error and module names such as `example` no longer suppress that error.
- Prompt echoes and explicit false/zero telemetry do not establish runtime failure. These remain local text heuristics, not a general natural-language or multi-line prompt parser.
- Per-finding retry advice cannot be more permissive than the overall incident decision. Provider restrictions, safety failures and running-job restrictions are covered.
- Existing schema, secret-canary, sanitized CLI errors and input-preservation checks still pass. No external provider, installation, paid generation or automatic retry was used.
- The skill-creator Python validator was attempted but the Windows Python alias exited 1 without running validation. The existing Node frontmatter/reference and schema tests passed; this is not a successful run of `quick_validate.py`.

The sections below retain the original validation history, not the current defect status.

Date: 2026-10-08. Environment: Windows, Node.js 24.21.0.

Command: `node --test tests/*.test.mjs`

Result: **46 passed / 0 failed**. Both bundled example incidents also ran successfully through the actual CLI.

Coverage includes:

- ComfyUI OOM stage, API and legacy UI workflow neighbors, missing dependencies.
- Runway safety, input, internal/upstream and bad-output families; unknown codes.
- fal typed errors, missing/true/false retry hints, HTTP versus task status.
- Replicate normal pending states, deadline assertions and unknown terminal failures.
- FFmpeg and webhook signatures; preserving generation artifacts in advice.
- Conflicting evidence, negated/example errors, ambiguous sources, caller assertions.
- Secret canaries, sanitized JSON errors, malformed/oversized input, graph bounds and references.
- CLI stdin/file paths, exit codes, JSON/text output, unchanged input fixtures.
- Output conformance for the JSON Schema keywords used, plus Skill frontmatter and reference checks.

Tests use synthetic fixtures, not production incidents. No provider was called and no video generation was charged. These tests do not establish real-world diagnostic accuracy, provider integration certification, calibrated confidence, or a guaranteed 30-second SLA.

Skill metadata/reference checks were performed in Node; the Python-based bundled skill validator was not run because this environment does not have a working Python interpreter.

Known boundaries: no live environment collection, no live provider status reconciliation, no automatic fixes, no external LLM API, no media-quality inspection, no newer ComfyUI object-link/subgraph format support. Publication and installation were not performed.

## Subsequent acceptance audit

The original 46 tests still pass. An additional black-box audit found **5 failures in 17 scenarios** (12 passed). The implementation was not changed during this test-only request. See [ACCEPTANCE_REPORT.md](ACCEPTANCE_REPORT.md) for reproduction details and limitations; the original green test suite is not sufficient evidence of release readiness.
