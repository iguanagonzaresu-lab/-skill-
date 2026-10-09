# v0.1 validation — 2026-10-08

Environment: Windows, Node.js 24, Git. No API calls, purchases, deployments,
dependency installs or network requests. Only this new product folder was edited.
Git fixtures and subprocess tests used isolated temporary repositories.

`node --test tests/*.test.mjs`: **28 passed, 0 failed**.

Covered:

- Deploy/Design/Content selection and overlapping changes.
- HEAD, explicit committed base, initial repository, staged/unstaged/untracked,
  rename/delete, spaces/newlines in names, invalid Git context and clean worktree.
- Added-line detection, existing vs new TODO, normal HTML placeholder attributes,
  conflict markers, malformed JSON and simple relative links.
- Secret-boundary omissions without value disclosure, binary/large files and
  outside-repository junctions; read-only scans preserve files and Git status.
- Missing vs executed checks, partial coverage, Design coverage not made green
  by successful build/test, failures and timeout outcomes.
- Actual npm PASS/nonzero-exit and timeout; pre/post hooks do not execute.
- CLI JSON and exit codes, frontmatter, local reference paths and UI metadata.

Not validated: Linux/macOS subprocess behavior, real browser rendering/a11y,
production deployments, migration correctness, non-npm/monorepo execution,
commercial usefulness or publication. Passing automated checks does not certify
release safety. These limits are explicit in the Skill and each generated report.

The skill-creator Python validator could not be used because this machine only
exposes a WindowsApps Python stub. Node tests check the entrypoint frontmatter,
referenced files and metadata; no Python installation was attempted.
