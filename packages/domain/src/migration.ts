/**
 * Migration contracts — Serialization.md §15, Widget-System.md §10.
 *
 * Three version axes evolve independently and are never conflated into one
 * "file version" (Serialization.md §15): the envelope's own version, the
 * document's `schemaVersion`, and each widget's `dataVersion`. This module
 * fixes the *shapes* of the document and widget-data migration contracts. The
 * load sequence that drives them belongs to `presentation-serialization`
 * (Serialization.md §10 step 3), and the registry that resolves a widget type
 * to its definition belongs to `presentation-widget-api`.
 *
 * These are contracts, not machinery: nothing here reads or writes anything.
 */

import type { WidgetTypeId } from "./ids.js";
import type { SerializedPresentationDocument } from "./serialized.js";

/**
 * The `schemaVersion` this engine writes. Domain-Model.md §3: versioning is
 * explicit from day one and starts at 1 (Design Principle 9), so the migration
 * machinery exists before there is anything to migrate — which is the point.
 */
export const CURRENT_SCHEMA_VERSION: 1 = 1;

/**
 * A document at some historical `schemaVersion`, whose shape is known only to
 * the migrations that handle it.
 *
 * Deliberately not `SerializedPresentationDocument`: a `schemaVersion: 1`
 * document is *not* today's shape, and typing it as such would be a lie that
 * every migration author then has to cast their way out of. Only the final
 * result of a completed chain is a `SerializedPresentationDocument`.
 */
export type UnknownDocument = Record<string, unknown>;

/**
 * One `schemaVersion` step.
 *
 * Serialization.md §15 requires migrations to be chained — loading a version-1
 * document into a version-5 engine runs 1→2→3→4→5 — and explicitly forbids a
 * single "jump" migration, so that each transition stays small, testable, and
 * independently reviewable. `from`/`to` are therefore a step, not a range.
 */
export interface DocumentMigration {
  /** The `schemaVersion` this step accepts. */
  readonly from: number;
  /** The `schemaVersion` this step produces; always `from + 1`. */
  readonly to: number;
  migrate(doc: UnknownDocument): UnknownDocument;
}

/**
 * The load-time entry point named by Serialization.md §15:
 * `migrate(doc, fromVersion) -> doc'`.
 *
 * An implementation composes the registered `DocumentMigration` steps from
 * `fromVersion` up to `CURRENT_SCHEMA_VERSION`. It throws
 * `UnsupportedSchemaVersionError` when `fromVersion` is newer than this engine
 * understands, or when the chain has a gap.
 */
export type MigrateDocument = (
  doc: UnknownDocument,
  fromVersion: number,
) => SerializedPresentationDocument;

/**
 * A widget's own data migration — `WidgetDefinition.migrate`
 * (Widget-System.md §3).
 *
 * The input is `unknown` because the core never inspects widget data
 * (Domain-Model.md §5, Design Principle 6); only the registering plugin knows
 * what its own older shapes were.
 */
export type MigrateWidgetData<TData = unknown> = (data: unknown, fromVersion: number) => TData;

/**
 * The narrow port the widget-data migration flow needs from a widget
 * definition (Widget-System.md §10's `def.version` / `def.migrate`).
 *
 * This package cannot reference `WidgetDefinition` — that contract lives in
 * `presentation-widget-api`, Ring 2, and Ring 0 imports nothing
 * (Package-Structure.md §3). So the flow's *requirement* is stated here as the
 * minimum surface it consumes, and the real definition satisfies it
 * structurally. Ring 0 declares what it needs; Ring 2 happens to provide it.
 */
export interface WidgetDataMigrator<TData = unknown> {
  /** The definition's current data-shape version. */
  readonly version: number;
  migrate?: MigrateWidgetData<TData>;
}

/**
 * Whether a widget instance's data is older than its definition, per
 * Widget-System.md §10's flow. A flat document `schemaVersion` while individual
 * widgets advance is the expected case, not an edge case
 * (Serialization.md §15).
 */
export function needsWidgetDataMigration(
  instanceDataVersion: number,
  definition: WidgetDataMigrator,
): boolean {
  return instanceDataVersion < definition.version;
}

/**
 * Raised when a document declares a `schemaVersion` this engine cannot reach.
 *
 * Serialization.md §15 requires failing **loudly** here. Guess-based partial
 * parsing of an unknown future schema is rejected outright as a strategy: a
 * clear "please update the engine" beats silent data corruption. The same error
 * covers a gap in the chain, which is the same failure from the reader's point
 * of view — the engine cannot reach the current version from this document.
 */
export class UnsupportedSchemaVersionError extends Error {
  override readonly name = "UnsupportedSchemaVersionError";
  /** The `schemaVersion` found in the document. */
  readonly foundVersion: number;
  /** The `schemaVersion` this engine writes. */
  readonly supportedVersion: number;

  constructor(
    foundVersion: number,
    supportedVersion: number = CURRENT_SCHEMA_VERSION,
    cause?: string,
  ) {
    super(
      cause ??
        `document schemaVersion ${foundVersion} cannot be migrated to ${supportedVersion} by this engine`,
    );
    this.foundVersion = foundVersion;
    this.supportedVersion = supportedVersion;
  }
}

/**
 * Raised when a widget's `dataVersion` is newer than its registered
 * definition. The widget-data axis needs the same loud failure as the document
 * axis (Serialization.md §15); Serialization.md §11's quarantine policy decides
 * whether the load survives it, which is that document's call, not this one's.
 */
export class UnsupportedWidgetDataVersionError extends Error {
  override readonly name = "UnsupportedWidgetDataVersionError";
  readonly widgetType: WidgetTypeId;
  readonly foundVersion: number;
  readonly supportedVersion: number;

  constructor(widgetType: WidgetTypeId, foundVersion: number, supportedVersion: number) {
    super(
      `widget "${widgetType}" has dataVersion ${foundVersion}, newer than the registered definition's ${supportedVersion}`,
    );
    this.widgetType = widgetType;
    this.foundVersion = foundVersion;
    this.supportedVersion = supportedVersion;
  }
}
