---
"@morpha/domain": minor
---

Add the migration contracts (Serialization.md §15, Widget-System.md §10):
`CURRENT_SCHEMA_VERSION`, `UnknownDocument`, `DocumentMigration`,
`MigrateDocument`, `MigrateWidgetData`, `WidgetDataMigrator`,
`needsWidgetDataMigration`, and the typed `UnsupportedSchemaVersionError` and
`UnsupportedWidgetDataVersionError`.

Shapes only: `DocumentMigration` steps are single-version by construction, and
the load-time runner that composes them belongs to
`presentation-serialization`.
