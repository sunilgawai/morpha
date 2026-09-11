---
"@morpha/domain": minor
---

Transcribe the Presentation Domain Model (Domain-Model.md §3–§10):
`PresentationDocument`, `DocumentMetadata`, `CanvasConfig`, `Page`,
`Background`, `WidgetInstance`, `Transform`, `ColorValue`, `Asset`, `Theme`,
and the entity ID types. Adds `SerializedPresentationDocument`/`SerializedPage`
as the persisted projection, which excludes the runtime-only derived caches
`pageOrder` and `Page.widgetOrder` (Serialization.md §4).

Types only — ordering, validation, and the injected-capability interfaces
arrive with T-002–T-005. The package still exports nothing that executes.
