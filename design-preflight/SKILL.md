---
name: design-preflight
description: Compare a specified Figma design with an implemented UI before a PR. Match design nodes to DOM elements and report measured layout, typography and color drift with evidence and suggested verification. Use for Figma-versus-implementation design QA, not generic code review, implementation-only screenshot regression or automatic fixes.
---

# Design Preflight

Check design intent against implementation, not yesterday's implementation against
today's. This v0.1 contains a **working offline comparison core** and the live
integration specification. It does not yet fetch Figma, start an app, control a
browser, generate annotated screenshots or perform pixel diffs automatically.

## Establish the reference

Ask for the intended Figma frame/version, target page, desktop viewport, theme and
interaction state. Confirm design is the approved reference, not an obsolete draft.
Do not treat a Figma URL or an old screenshot as proof the data was retrieved.
Read [integration](references/integration.md) when gathering real design/browser data.
Read [rules and normalized inputs](references/rules.md) before constructing snapshots.

## Match before comparing

Use explicit node ID → unique selector mapping, preferably stable data attributes.
Do not silently choose the first text/name match. A missing, ambiguous, hidden or
unresolved element is WARN / insufficient mapping evidence, not a styling failure.
Keep Figma frame-relative geometry and DOM container-relative geometry in CSS px.
Resolve font availability, screenshot scale, state and theme before comparing.

## Run deterministic rules

For normalized snapshots, use Node.js 22+:

```text
node <skill-folder>/scripts/compare.mjs --design <design.json> --actual <actual.json> --json
```

The three packs are Layout, Typography and Color. Run the bundled offline rules
before interpreting results. Missing values, unsupported properties or mismatched
capture contexts remain WARN. Never replace them with zero or call them a PASS.
The runner does not use the network, execute project code or modify target files.

Live adapters are specified in [CLI contract](references/cli.md), not implemented.
If Figma/browser tooling is available, request only authorized read operations and
normalize its evidence according to the contract. Do not install plugins, start
services, change designs, submit forms or upload screenshots implicitly.

## Explain without inventing causes

For each discrepancy, retain node ID/selector, expected, actual, delta and tolerance.
Explain the visual risk, a possible cause, suggested investigation/fix and verification.
A geometry mismatch cannot prove a React prop or token binding is wrong. Inspect
the actual component/style source before naming a prop or presenting a code patch.
Unverified explanations must be marked hypotheses. Never claim a missing design
token from equal-looking colors alone; token provenance is not implemented here.

## Final report

Use PASS / WARN / FAIL with counts and coverage, not an invented readiness score.
PASS only applies to successfully compared declared properties. If live extraction
or screenshot checks were requested but not performed, the **overall live review
is WARN**, even if the offline core returns PASS. FAIL means a measured difference
exceeds the stated rule tolerance, not necessarily a confirmed product defect.

List sources, design version, capture environment, matched/unmatched elements,
executed/skipped checks, measured discrepancies and unresolved assumptions.
Shape, content, visual screenshots, token identity, responsive/mobile, Safari,
Storybook integration, PR comments and automatic correction are out of v0.1 scope.
Never present synthetic examples as measurements of the user's application.
