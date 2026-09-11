---
"@morpha/domain": minor
---

Add the injected-capability contracts (`IdGenerator`, `Rng`, `Clock`,
`TextMeasurer` — Design Principle 8, ADR-0005 §3, ADR-0006) and publish their
deterministic implementations plus pure document fixtures on a new `./testing`
subpath export (ADR-0012): `sequentialIdGenerator`, `seededRng`, `fixedClock`,
`recordingTextMeasurer`, `fixtureDocument`, `fixturePage`, `fixtureWidget`, and
their serialized counterparts.

`TextRun`/`MeasureConstraints`/`TextLayout` are deliberately opaque until
Text-System.md exists, so the text measurer double records calls rather than
producing metrics.
