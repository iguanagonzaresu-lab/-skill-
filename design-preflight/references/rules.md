# First three rules and normalized schema

## Snapshot

Both files use:

```json
{
  "schema_version": 1,
  "source": {"kind":"synthetic", "reference":"example only"},
  "context": {"width":1440,"height":900,"dpr":1,"theme":"light","state":"default","coordinate_space":"frame-css-px"},
  "elements": [{"id":"1:2","selector":"[data-design-id=primary]","properties":{"height":48}}]
}
```

Design source kinds: figma, manual, synthetic. Actual: browser, manual, synthetic.
Metadata identifies input provenance but is not cryptographic proof of extraction.
Actual elements additionally require `matches: 1`, `visible: true`, `fonts_ready: true`.
Use zero/multiple matches or false for unknown/non-comparable situations, not guessed
styles. Each ID is unique; mapping selectors must agree between the two snapshots.
Extra actual IDs produce WARN because unmatched implementation elements were not reviewed.
Omitted design fields are explicitly outside measured scope; a declared null field is WARN.
Unknown property names produce WARN so a typo cannot make a check pass silently.

## 1. Layout

Fields: x, y, width, height, padding_top, padding_right, padding_bottom, padding_left,
row_gap, column_gap. Finite CSS pixel numbers; sizes/padding/gaps cannot be negative.
Compare absolute difference, default tolerance **1 CSS px inclusive**. Coordinates
are relative to the same design frame / implementation root, not absolute page offsets.
Different viewport, DPR, theme, state or coordinate space stops all comparisons with WARN.
Auto layout Figma values are not blindly equivalent to CSS padding/gap. Auto/percent,
transforms, rotated bounds and unresolved layout become null until normalized reliably.
Alignment is not included in the executable v0.1 rule.

## 2. Typography

Fields: font_size (px), font_weight (number), line_height (px), letter_spacing (px).
Font weight tolerance **0**, other tolerances **0.5 px inclusive**.
Negative letter spacing is supported. Size/height must be positive; weight 1–1000.
`normal`, percentages and mixed text styles must be resolved to px or kept null.
Do not measure before fonts settle. `fonts_ready:false` blocks typography comparison
with WARN; font family, actual glyph/fallback identity and text content are not checked.

## 3. Color

Fields: background_color, text_color, border_color. Normalized sRGB RGBA arrays:
`[r,g,b,a]`, RGB 0–255, alpha 0–1. Maximum channel delta, alpha multiplied by 255;
default tolerance **2/255 inclusive**. This is a numerical threshold, not perceptual
Delta E or contrast/accessibility certification. If both alpha values are zero,
RGB differences are visually irrelevant and normalized to zero for comparison.
Only resolved solid colors with the same compositing convention can be compared.
Multiple fills, gradients, image paints, mixed text colors and unresolved inherited
opacity become null. Token identities/bindings are not inferred from color equality.

## Interpretation

Above tolerance → FAIL for this measured property. Unknown/non-comparable → WARN.
Report delta and threshold, never just "pixels changed". Suggested causes are generic
investigations until code evidence supports a component/prop/token-level explanation.
Do not add a synthetic total score or claim complete UI conformance from partial data.
