# ADR-0006 — Text Measurement Is an Engine-Injected Capability, Not a Renderer Behavior

**Status:** Accepted
**Date:** 2026-07-12
**Resolves:** Readiness Review C6 (text measurement/line-breaking/font
metrics — the determinant of cross-renderer and export fidelity — was
absent from the entire handbook)

## Context

A presentation engine's core promise is "the document looks the same in
the editor, the thumbnail, and the PPTX/PDF export." That promise lives or
dies on text: line breaks and glyph metrics computed differently by DOM,
Canvas, and PDF backends produce visibly different documents from
identical domain state. Leaving measurement to each renderer family (the
implicit default) makes fidelity structurally impossible; deciding this
after the Text widget ships means rewriting the Text widget, every
renderer, and every exporter.

## Decision

1. **Text measurement is a single engine-level capability**, injected at
   engine construction like the ID generator:

   ```typescript
   interface TextMeasurer {
     measure(runs: TextRun[], constraints: MeasureConstraints): TextLayout;
     // TextLayout: line boxes, glyph advances, total bounds — engine units
   }
   createEngine({ textMeasurer, ... });
   ```

2. **All consumers use the same measurer.** The Text widget's layout, hit
   testing inside text, renderers' line placement, and exporters' text
   positioning all consume `TextLayout` produced by the injected measurer
   — renderers *paint* text, they never *measure* it authoritatively.
3. **Environments supply implementations** of the same contract: a
   browser build may back it with `CanvasRenderingContext2D.measureText`
   or a WASM shaping library; a Node export worker must use a
   metrics-compatible implementation (same shaping engine or embedded
   font metrics). **Fidelity guarantee = same measurer contract + same
   font data**, which is now an explicit, testable statement rather than
   an accident.
4. **Font data is an Asset concern**: fonts resolve through the existing
   Asset Provider mechanism; the measurer receives resolved font data,
   never fetches it (Principle 11).

## Consequences

- Engine-Lifecycle.md §4.2 registers the measurer as an injected
  capability; deterministic-core compliance because measurement is a pure
  function of (runs, constraints, font data).
- A full **Text-System.md** (rich-text run model, editing/IME/caret,
  bidi, shaping strategy) is added to the roadmap as **required before
  the Text widget is implemented** — this ADR fixes ownership and the
  seam, not the whole design.
- LOD/zoom-dependent rendering decisions remain renderer-owned
  (Rendering-Architecture.md §12) — this ADR governs *metrics*, not
  paint quality.
