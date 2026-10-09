# Design check pack

Use for shared components, markup, styles, fonts, icons and images. Also inspect
affected pages reached through changed components, rather than only changed files.

- Identify the intended visual baseline; absent baseline means no visual-diff claim.
- If a local application and browser tooling are available/authorized, verify at
  375, 768 and 1440 CSS pixels, plus any changed breakpoint. Record actual widths.
- Check overflow, clipping, navigation, visible labels, focus order, keyboard
  activation, error/empty/loading states and contrast on changed interfaces.
- Compare screenshots only when both baseline and current render are available.
  A changed screenshot is evidence of a difference, not automatically a defect.
- Prefer existing Playwright/visual/a11y tests. Inspect their commands/configuration;
  do not install browsers, start external services or rewrite snapshots implicitly.

No screenshot/test change in a diff does NOT prove missing tests or a UI bug.
Report "visual/behavioral verification not performed" with changed paths as a WARN.
Do not claim accessibility compliance from a build passing or a static heuristic.
The bundled CLI does not render browsers. Attach measured evidence separately.
