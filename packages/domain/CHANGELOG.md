# @morpha/domain

## 0.1.0

### Minor Changes

- 86fb4c1: Add the migration contracts (Serialization.md §15, Widget-System.md §10):
  `CURRENT_SCHEMA_VERSION`, `UnknownDocument`, `DocumentMigration`,
  `MigrateDocument`, `MigrateWidgetData`, `WidgetDataMigrator`,
  `needsWidgetDataMigration`, and the typed `UnsupportedSchemaVersionError` and
  `UnsupportedWidgetDataVersionError`.

  Shapes only: `DocumentMigration` steps are single-version by construction, and
  the load-time runner that composes them belongs to
  `presentation-serialization`.

- a9f7da2: Transcribe the Presentation Domain Model (Domain-Model.md §3–§10):
  `PresentationDocument`, `DocumentMetadata`, `CanvasConfig`, `Page`,
  `Background`, `WidgetInstance`, `Transform`, `ColorValue`, `Asset`, `Theme`,
  and the entity ID types. Adds `SerializedPresentationDocument`/`SerializedPage`
  as the persisted projection, which excludes the runtime-only derived caches
  `pageOrder` and `Page.widgetOrder` (Serialization.md §4).

  Types only — ordering, validation, and the injected-capability interfaces
  arrive with T-002–T-005. The package still exports nothing that executes.

- 961fd0f: Add the fractional-index ordering utility (Ordering-Strategy.md):
  `generateKeyBetween`, `generateNKeysBetween`, `compareOrderKeys`,
  `compareOrdered` and the `Ordered` shape. Collision-avoidance jitter is drawn
  from the injected `Rng` (ADR-0005 §3), so key generation is replayable under a
  seeded source, and `compareOrdered` applies the required `id` tie-break.

  The base-62 algorithm is vendored with attribution rather than taken as a
  dependency, because this package carries no runtime dependencies.

- ba0f641: Add the injected-capability contracts (`IdGenerator`, `Rng`, `Clock`,
  `TextMeasurer` — Design Principle 8, ADR-0005 §3, ADR-0006) and publish their
  deterministic implementations plus pure document fixtures on a new `./testing`
  subpath export (ADR-0012): `sequentialIdGenerator`, `seededRng`, `fixedClock`,
  `recordingTextMeasurer`, `fixtureDocument`, `fixturePage`, `fixtureWidget`, and
  their serialized counterparts.

  `TextRun`/`MeasureConstraints`/`TextLayout` are deliberately opaque until
  Text-System.md exists, so the text measurer double records calls rather than
  producing metrics.

- cee4f34: Add structural validation (Domain-Model.md §12): `validateDocument`,
  `ValidationResult`, `ValidationIssue`, `ValidationIssueCode`,
  `mergeValidationResults`, `validResult`, and the `WidgetTypeLookup` /
  `WidgetDataValidator` ports introduced by ADR-0013. The testing subpath gains
  `stubWidgetTypeLookup`, `acceptingWidgetDataValidator` and
  `rejectingWidgetDataValidator`.

  Validation checks references, parent-chain cycles, theme and asset lookups, and
  optionally the runtime-only derived caches; widget `data` is delegated to the
  widget's own validator and never inspected by the core. Issues accumulate rather
  than throw.
