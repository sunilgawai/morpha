# @morpha/testing

**Ring 3** · **Status: placeholder — no implementation yet**

Shared test utilities: `createTestEngine()` (deterministic clock/ID/RNG/text-measurer injection), `fixtureDocument()`, `mockRenderer()`, assertion helpers. devDependency-only for every consumer.

- Owning architecture document: [docs/architecture/packages/Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
