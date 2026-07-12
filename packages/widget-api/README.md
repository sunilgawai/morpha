# @morpha/widget-api

**Ring 2** · **Status: placeholder — no implementation yet**

The widget authoring contract: `defineWidget()`, `WidgetDefinition<T>` (including `hitTest`), the Widget Registry, and `RenderNode` (homed here per Package-Structure.md 1.1.0). Widgets never construct or dispatch Commands.

- Owning architecture document: [docs/architecture/widgets/Widget-System.md](../../docs/architecture/widgets/Widget-System.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
