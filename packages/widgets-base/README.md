# @morpha/widgets-base

**Ring 2** · **Status: placeholder — no implementation yet**

The first-party reference widgets (`text`, `image`, `rect`, `group`) built via the exact same `WidgetDefinition` contract any third party uses — the living compliance test for Design Principle 6 (Widget-System.md §5).

- Owning architecture document: [docs/architecture/widgets/Widget-System.md](../../docs/architecture/widgets/Widget-System.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
