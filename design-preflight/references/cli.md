# CLI specification — implemented vs planned

## Implemented v0.1 offline contract

```text
node scripts/compare.mjs --design FILE --actual FILE [--json]
```

Node.js 22+, no npm dependencies. Exactly two normalized UTF-8 JSON input files.
Each at most 2 MB / 1000 elements. Output is terminal text or JSON on stdout.
No output files, mutation, network, package installs, API calls or secret storage.
Exit codes: 0 scoped PASS, 1 WARN, 2 FAIL, 64 invalid arguments/input.
Unknown options are rejected, not silently interpreted as supported integrations.

Output fields: schema_version, status, scope, context, compared_properties,
passed_properties, findings, limitations. Every finding includes severity, rule,
node_id, selector, property, expected, actual, delta, tolerance, evidence, risk,
possible_cause, suggested_fix and verify. Causes are not confirmed from pixels.
Example snapshots are synthetic and identified as such in their source metadata.

## Planned live adapter contract — NOT executable yet

```text
design-preflight capture --figma <frame-url> --url <local-url> --mapping <mapping.json>
```

This name is not an npm-published package. Do not run `npx design-preflight` expecting
this local product. A Figma connection and authorized test application are still needed.

Stages:

1. Resolve Figma file/version and exact node, fetch read-only structured design.
2. Validate allowed target origin and unique selectors from mapping, never page text.
3. Capture Chromium viewport/container geometry and computed styles once fonts and
   layout settle. Reject unexpected redirects; do not interact with production.
4. Normalize values into the v0.1 schema; unknown transforms/paint/text stay null.
5. Execute the same offline comparator.
6. Later visual adapter: export frame at matching scale, capture implementation,
   create measured overlays and optional image diff under a user-selected folder.

Initial live target: React/Next.js, desktop Chromium. DOM measurement is framework
independent, but framework-specific source explanations require separate inspection.
Installation/browser download, app startup and Figma authorization must be explicit.
The live tool must redact tokens, strip credentials from URLs and bound time/payload.
401/403/429 should stop with an actionable message, without bypasses or rapid retries.
