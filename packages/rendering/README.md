# @morpha/rendering

**Ring 2** · **Status: placeholder — no implementation yet**

The renderer-agnostic projection core: the canonical `RendererAdapter` contract (ADR-0004), `RenderState`/`RenderContext`, reconciliation utilities, virtualization support. Renderer families live in their own downstream packages.

- Owning architecture document: [docs/architecture/rendering/Rendering-Architecture.md](../../docs/architecture/rendering/Rendering-Architecture.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
