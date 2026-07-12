# @morpha/domain

**Ring 0** · **Status: placeholder — no implementation yet**

The Presentation Domain Model: `PresentationDocument`, `Page`, `WidgetInstance`, `Transform`, `Theme`, `Asset`, validation primitives, versioning/migration contracts, and the fractional-index ordering utility (Ordering-Strategy.md). Zero runtime dependencies — pure data types and pure functions only.

- Owning architecture document: [docs/architecture/domain/Domain-Model.md](../../docs/architecture/domain/Domain-Model.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
