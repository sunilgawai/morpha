# presentation-export-pptx

**Ring 2** · **Status: placeholder — no implementation yet**

PPTX exporter — translates a `PresentationDocument` into OOXML bytes. Never renders UI, never mutates the document (Serialization.md §17). Node primary.

- Owning architecture document: [docs/architecture/persistence/Serialization.md](../../docs/architecture/persistence/Serialization.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
