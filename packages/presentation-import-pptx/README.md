# presentation-import-pptx

**Ring 2** · **Status: placeholder — no implementation yet**

PPTX importer — parses OOXML into a `PresentationDocument` value or Import Commands (Command-System.md §4). Never knows about rendering. Node primary.

- Owning architecture document: [docs/architecture/persistence/Serialization.md](../../docs/architecture/persistence/Serialization.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
