# Severity and evidence

**BLOCK**: observed failing required check, malformed changed JSON, or an added
unresolved conflict marker. Describe the actual failure and whether its relation
to the change is proven. BLOCK is not permission to modify files.

**WARN**: incomplete scope/baseline, missing or unsafe tooling, timeout, unreadable
or uninspected content, unsupported execution environment, risk needing validation,
or a change without required visual/content/operational verification.

**PASS**: every required check for the explicitly stated scope has run successfully
and there are no unresolved relevant BLOCK/WARN findings. A static scanner PASS is
not production readiness, an approval to publish, or a claim of zero bugs.

Every finding must have Evidence, Risk, Fix and Verify. Evidence can be a concrete
coverage gap, e.g. "2 CSS paths changed; no browser render performed in this run".
Do not turn that into "mobile layout is broken". Suggested fixes remain suggestions.
Do not output probabilities, fabricated visual diffs or a readiness percentage.

CLI exit codes: 0 = scoped PASS, 1 = WARN, 2 = BLOCK, 64 = invalid CLI arguments.
WARN is deliberately nonzero so absent evidence does not silently greenlight CI.
