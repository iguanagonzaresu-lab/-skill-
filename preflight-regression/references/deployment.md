# Deploy check pack

Use for code, API/routes, package/lockfiles, runtime configuration, CI or deployment
changes. Classification alone is not evidence that deployment is broken.

1. Read the changed interfaces and direct consumers. Identify the runtime and the
   package manager from repository instructions and lockfiles. In a monorepo locate
   affected workspaces; the v0.1 runner only discovers root npm scripts.
2. Review existing test/build/lint/typecheck scripts before execution. Use already
   installed dependencies. Prefer focused deterministic tests, followed by required
   build/type checks. Do not run install, deploy, publish or migrations by default.
3. Check changed configuration references against documented variable **names**.
   Missing local `.env` is not proof production configuration is missing. Never read
   secret values into a report or send them externally.
4. For routes, identify changed method/path/auth consumers and existing tests. Run
   smoke tests only against an authorized local/test instance. Untested route
   contracts remain WARN, not a fabricated 404 or authentication regression.
5. Migration changes produce a follow-up WARN in v0.1. Inspect nullability, data
   backfill, rollback and deployment order only with schema/environment context;
   request specialist evidence. Never execute a migration on production.

Record command, workspace, runtime, outcome and duration. Nonzero exit is a real
failed gate, but causality is unknown unless baseline evidence establishes it.
Tests can change artifacts and environment; record resulting changes without
deleting them. If tooling is missing or unsafe, state the coverage gap and stop.
