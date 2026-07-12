# @morpha/plugin-api

**Ring 2** · **Status: placeholder — no implementation yet**

The general extensibility surface: `PluginManifest`, `PluginContext`, activation events, permissions, and every Extension Point registry interface. Sandboxed tier is scoped to data-shaped contributions (ADR-0005 §1).

- Owning architecture document: [docs/architecture/plugins/Plugin-System.md](../../docs/architecture/plugins/Plugin-System.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
