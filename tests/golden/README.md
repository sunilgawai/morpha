# tests/golden/

**Golden-file Tests**

Byte-for-byte comparisons against committed fixtures under `fixtures/`: serialized-document round-trips (Serialization.md) and exporter output (export-pptx). Regenerate fixtures deliberately and review the diff — a golden file changing silently is a defect, never a rubber-stamp.

See [../README.md](../README.md) for the full taxonomy and the single-
vs-cross-package dividing line.
