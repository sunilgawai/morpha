# tests/contract/

**Contract Conformance Suites**

Shared, reusable conformance suites for every handbook contract — `RendererAdapter` (Rendering-Architecture.md §17), `WidgetDefinition` (Widget-System.md), and importer/exporter adapters. A third-party implementation imports the suite and proves it conforms. This is the cross-package home; a package may also run the suite against its own implementation in its local `test/`.

See [../README.md](../README.md) for the full taxonomy and the single-
vs-cross-package dividing line.
