# Figma and browser integration plan

Checked official references on 2026-10-08. Live adapters are not in this delivery.

## Figma

Use an explicitly authorized Figma connection or read-only REST access. Keep tokens
outside source, screenshots and reports. Record file/frame/version and observation
time. Retrieve only the requested subtree, not the user's entire Figma account.

[Figma node types](https://developers.figma.com/docs/rest-api/file-node-types/)
describe node geometry, layout and style data. Normalize those properties deliberately:
frame-relative coordinates, CSS px assumptions, individual text runs and paint types.
Absence or unsupported paint is unknown, not a black color or zero spacing.

[Figma Dev Mode](https://www.figma.com/dev-mode/) describes MCP design context and
Code Connect mappings. These can supply evidence for matching design and components;
they do not establish that this product is connected or every node is uniquely mapped.
Use explicit mapping overrides when names and hierarchy disagree. Never auto-select
the first matching DOM node or claim a live fetch was made from a URL alone.

## Chromium / Playwright

[Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
describe screenshot assertions and environment-dependent rendering. Keep browser,
OS, fonts, viewport, DPR, theme, locale, data and animation state fixed for a pair.
For Figma-versus-browser comparison, the Figma export is the design reference; do not
silently substitute a previous browser baseline and call that design validation.

Before capturing, verify the root locator and each mapped selector resolves once,
is visible, fonts are ready and the page is in the requested state. Collect bounding
rectangles relative to the selected root and resolved computed styles. No arbitrary
page-provided scripts, token exfiltration, form submission or unsolicited publishing.

Future annotated screenshots should outline measured nodes with finding IDs and
include the original capture separately. Mask private data before sharing. Reuse
existing Playwright/image comparison tools rather than writing a new pixel engine.
