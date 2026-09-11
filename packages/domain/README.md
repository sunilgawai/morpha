# @morpha/domain

**Ring 0** · **Status: in progress — the domain model is transcribed; ordering
and validation are next (TASKS.md T-002, T-003)**

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

## Not here

Ordering (`generateKeyBetween`), `validateDocument`, the `migrate()` contract,
and the injected-capability interfaces with their deterministic
implementations on the `./testing` subpath (ADR-0012) arrive with T-002–T-005.
