# @presentation/react

**Ring 3** · **Status: placeholder — no implementation yet**

React bindings: hooks (`useEngine`, `useSelection`, `useWidget`), a `RenderNode`-to-React reconciler, `<PresentationCanvas>`. Session-scoped per ADR-0004. `react`/`react-dom` become peer dependencies when implementation begins.

- Owning architecture document: [docs/architecture/packages/Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
