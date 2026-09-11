# @morpha/domain

**Ring 0** · **Status: in progress — model, capabilities and ordering are in;
validation is next (TASKS.md T-003, blocked on a governance decision)**

The Presentation Domain Model. Zero dependencies — pure data types and pure
functions only, compiling without DOM or Node libs.

- Owning architecture document: [Domain-Model.md](../../docs/architecture/domain/Domain-Model.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

## Public surface

| Export | Document |
| --- | --- |
| `PresentationDocument`, `DocumentMetadata`, `CanvasConfig` | §3 |
| `Page`, `Background` | §4 |
| `WidgetInstance`, `LayoutConstraints` | §5 |
| `Transform` | §6 |
| `ColorValue`, `ThemeColorToken` | §7 |
| `Asset`, `AssetSource` | §8 |
| `Theme` | §9 |
| `EntityId`, `PageId`, `WidgetId`, `AssetId`, `ThemeId`, `LayoutId`, `WidgetTypeId` | §10 |
| `SerializedPresentationDocument`, `SerializedPage` | §3 + Serialization.md §4 |
| `IdGenerator`, `Rng`, `Clock`, `TextMeasurer` | Design Principle 8; ADR-0005 §3; ADR-0006 |
| `generateKeyBetween`, `generateNKeysBetween`, `compareOrdered`, `compareOrderKeys`, `Ordered` | Ordering-Strategy.md |
| `CURRENT_SCHEMA_VERSION`, `DocumentMigration`, `MigrateDocument`, `MigrateWidgetData`, `WidgetDataMigrator`, `needsWidgetDataMigration` | Serialization.md §15; Widget-System.md §10 |
| `UnsupportedSchemaVersionError`, `UnsupportedWidgetDataVersionError` | Serialization.md §15 |

### Live shape vs. persisted shape

The interfaces describe the **live in-memory** document. `pageOrder` and
`Page.widgetOrder` are derived caches, rebuilt by the Store on hydration and
never serialized (Domain-Model.md §3; Serialization.md §4). The `Serialized*`
types are the persisted projection: a derived cache cannot be declared on a
persisted value or read off one. They are not a runtime guarantee — a spread
still carries the field, because TypeScript does not excess-property-check
spreads. Stripping at the boundary is Serialization.md §4's job (property row
P12).

### Shapes are transcribed, not designed

Every type here is a verbatim transcription of the handbook. Changing a shape
requires an ADR or a follow-up patch against Domain-Model.md — not an edit to
this package. `LayoutConstraints` is deliberately `unknown` until
Layout-System.md exists (Domain-Model.md §5, 1.2.0).

### Ordering

`order` is a base-62 fractional index (Ordering-Strategy.md). Generation takes
the engine's injected `Rng`, because the collision-avoidance jitter must be
replayable (ADR-0005 §3) — there is no ambient-randomness overload. The
algorithm is vendored from the established reference rather than depended upon,
since this package carries zero runtime dependencies; a committed table of the
reference's published values keeps the two in step.

### Migration contracts, not machinery

The document and widget-data migration *shapes* live here; the load sequence
that composes them is `presentation-serialization`'s (Serialization.md §10).
`DocumentMigration` steps are single-version by construction — `to` is always
`from + 1` — because Serialization.md §15 forbids jump migrations.

`WidgetDataMigrator` is worth noting as a pattern: Ring 0 cannot reference
`WidgetDefinition` (Ring 2), so it declares the *minimum surface it consumes*
and the real definition satisfies it structurally. Ring 0 states its needs;
outer rings happen to meet them.

## Not here

`validateDocument` arrives with T-003.
