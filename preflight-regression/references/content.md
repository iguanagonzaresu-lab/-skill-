# Content check pack

Use for docs, landing pages, HTML, metadata and public-facing strings.

- The scanner checks newly added TODO/TBD/FIXME/placeholder markers and simple
  relative Markdown/HTML links. A marker is a review cue (WARN), never automatically
  a shipping defect. Code examples may intentionally contain placeholders.
- Confirm intended publication scope. Documentation links may be generated at
  build time; a missing local target is WARN until the build/routing context is known.
- Manually inspect titles, descriptions, canonical/share URLs, headings, dates and
  version references affected by the change. Compare against actual release facts;
  do not call an old date wrong solely because it is old.
- Fragment anchors, dynamic routes, reference-style links, full HTML/Markdown
  parsing, image rendering and external URL availability are not validated by the
  v0.1 scanner. Test those separately when applicable; do not report them as passed.
- External link checks are not automatic. When authorized, use bounded requests
  and distinguish access controls/rate limits from a genuinely unavailable page.

State exact locations without quoting sensitive source text. Avoid downloading
remote content or executing embedded scripts as part of a content review.
