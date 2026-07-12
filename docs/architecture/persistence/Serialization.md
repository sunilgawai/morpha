# Serialization.md

**Status:** Core — changes require an ADR (governed by Architecture-Index.md §11)
**Version:** 1.1.0
**Depends on:** Domain-Model.md, Widget-System.md, Engine-Lifecycle.md, Command-System.md

---

## 1. Purpose

This document defines the **canonical persistence architecture** of the
Presentation Engine — not "how to call JSON.stringify," but the durable
document format, its structural guarantees, and every adapter's contract
for reading and writing it. This is the authoritative reference every
future Importer, Exporter, storage provider, and collaboration provider
must build against. The Presentation Domain Model (Domain-Model.md) remains
the single source of truth; **serialization is a persistence adapter over
that model, never a competing representation of it** — the same "everything
is an adapter" rule established in Design-Principles.md Principle 2, applied
here specifically to disk/network persistence rather than rendering/export.

## 2. The Canonical Document Format Is Ours, Not a Container Format Borrowed From Elsewhere

The canonical serialized form is a **self-describing envelope wrapping a
versioned Domain Model snapshot** — structurally similar in spirit to how
Figma's `.fig` format embeds its own schema definition inside the file so
it can be decoded without external schema files [web:181][web:187], and how
tldraw's `Store` snapshot format carries its own schema/migration metadata
[web:184][web:186]. We do not adopt OOXML, PDF, SVG, or HTML as the
canonical format, per Vision.md — those remain Import/Export targets
only (Section 13).

```
CanonicalDocumentEnvelope
├── envelopeVersion: number         (envelope structure itself, rarely changes)
├── formatId: "presentation-engine" (magic identifier, prevents silent
│                                     misinterpretation by unrelated tools)
├── schemaVersion: number           (Domain-Model.md's PresentationDocument.schemaVersion)
├── integrity: IntegrityBlock       (Section 10)
├── document: PresentationDocument  (Domain-Model.md, Section 3 — the actual content)
└── assetManifest: AssetManifestEntry[]  (Section 5 — NOT the asset bytes themselves)
```

`envelopeVersion` and `schemaVersion` are **deliberately separate axes**,
mirroring the same separation already established for widget data
(Widget-System.md Section 3) and event payloads (Event-System.md Section
12) — the envelope's own shape (e.g., adding `integrity` in the future)
evolves independently of the Domain Model's shape.

## 3. What Is Serialized

Only what Domain-Model.md defines as persisted domain state:

- `PresentationDocument` in full — `pages`, `widgets`, `assets` (as
  references, Section 5), `themes`, `metadata`, `canvas`.
- Each widget's `data` payload and `dataVersion` (Widget-System.md Section
  10) — opaque to the serializer, validated only structurally at load time
  (Domain-Model.md Section 12).

That is the entire list. Nothing else qualifies.

## 4. What Must Never Be Serialized

Directly inherited and restated from Domain-Model.md Section 11 and
Selection-and-Interaction.md Section 4/18, because serialization is exactly
the layer where a violation of these boundaries would first become
user-visible (a saved file containing another user's cursor position, for
instance):

- **Selection, hover, focus state** (Selection-and-Interaction.md Section
  4) — session-local, never persisted.
- **History/undo stack** (Command-System.md Section 11) — a property of a
  runtime session, not of the document; two people opening the same saved
  file must not inherit each other's undo history.
- **Renderer-internal caches** (Rendering-Architecture.md Section 2) — DOM
  nodes, canvas buffers, memoized layout — disposable and renderer-owned,
  never domain state.
- **Live collaboration presence** (peer cursors, `peerJoined` state,
  Event-System.md Section 14) — transport-layer ephemera, not document
  content.
- **Computed/derived caches** like `pageOrder`/`widgetOrder`
  (Domain-Model.md Section 3) — these are recomputable from `Page.order`/
  `WidgetInstance.order` and are **not** part of the canonical serialized
  form; they are rebuilt on load (Section 14), avoiding a second
  source-of-truth-within-the-file problem.

## 5. Assets Are Referenced, Never Embedded by Default

The canonical envelope stores an `AssetManifestEntry` per asset — metadata
and a resolvable reference — never raw binary bytes inline in the primary
document structure, for the same reason Domain-Model.md Section 8 keeps
`AssetSource` reference-only in the live model: the engine has no opinion on
storage backend (Principle 11), and inlining large binaries into a JSON-like
structure defeats incremental loading (Section 8) and partial loading
(Section 9).

```typescript
interface AssetManifestEntry {
  id: AssetId;
  kind: Asset["kind"];
  checksum: string;              // content hash — see Section 10
  sizeBytes: number;
  storageRef: AssetStorageRef;   // Section 6 — where the bytes actually live
}
```

**Exception — small inline assets:** `AssetSource` already permits a
`dataUri` variant (Domain-Model.md Section 8) for genuinely tiny assets
(icons, small vector snippets) where the overhead of a separate storage
fetch exceeds the cost of inlining. This is a size-based judgment call left
to the application/exporter, not an engine-enforced threshold — the engine
supports both, decides neither.

## 6. Asset Storage Reference

```typescript
type AssetStorageRef =
  | { type: "external-url"; url: string }
  | { type: "content-addressed"; store: string; hash: string }
     // e.g., a CAS bucket keyed by SHA-256 — enables automatic
     // cross-document deduplication, the same principle behind
     // content-addressed asset stores generally
  | { type: "sidecar"; path: string };
     // for a multi-file-on-disk packaging scheme, see Section 7
```

The engine defines this contract; it never implements asset storage itself
(Domain-Model.md Section 8, Principle 11 restated). A storage provider
(a host application's own service, or a first-party adapter package) is
responsible for actually resolving `content-addressed`/`sidecar` refs into
bytes.

## 7. Packaging: Single-File vs. Multi-File Envelope

Two supported packaging strategies, chosen by the calling application, not
fixed by the engine:

- **Single-file (archive) packaging** — the envelope plus all referenced
  asset bytes bundled into one archive container (e.g., a ZIP-like
  structure with `document.json`, `assets/<hash>.<ext>`, and an optional
  `thumbnail.png` for fast preview) — directly analogous to how `.fig`
  files bundle a Kiwi-encoded scene alongside image blobs and a preview
  thumbnail in one container [web:191][web:192][web:188].
- **Multi-file (sidecar) packaging** — the envelope alone, with
  `AssetStorageRef`s pointing to externally-hosted or database-stored
  assets — appropriate for a cloud SaaS storing assets in an existing
  object store rather than duplicating them per document.

The **canonical document format itself is packaging-agnostic** — both
strategies serialize the identical `CanonicalDocumentEnvelope` structure;
they differ only in how `AssetStorageRef`s resolve and whether bytes travel
alongside the envelope or not.

## 8. Lazy Loading

Loading a document does not require resolving every asset upfront. The
Engine's load sequence (Engine-Lifecycle.md Section 4.3) hydrates the
`PresentationDocument` structure (pages, widgets, transforms, `data`
payloads) immediately, but `AssetManifestEntry` resolution to actual bytes
is deferred until a renderer or exporter actually requests an asset's
content via the Asset Manager (Engine-Lifecycle.md Section 6.9). This means
opening a 200-image presentation is bounded by document *structure* size,
not by total asset payload size — assets stream in on demand, matching the
Asset Manager's existing on-demand resolution contract.

## 9. Partial Document Loading

For very large documents (hundreds of pages), the canonical format supports
**page-level partial hydration**: an application may request
`engine.documents.loadPartial(envelope, { pageIds: [...] })`, which
validates the full document's **reference graph** — the ID/`pageId`/
`parentId`/`order` fields of every entity, readable from the envelope
without materializing widget `data` payloads or running plugin validators
(clarified 1.1.0: referential integrity needs only the ID graph; per-widget
`data` validation runs when a page is actually materialized) — and only
fully materializes `WidgetInstance` records for the requested pages into
the live Store. Unloaded pages remain addressable (their `Page`
metadata and `pageOrder` position are known) but their widgets are not
resident in memory until requested — a `loadPage(pageId)` call on the
`DocumentSession` promotes a page from addressable-but-unloaded to fully
loaded. This is the serialization-layer counterpart to
Rendering-Architecture.md Section 11's renderer-side virtualization: that
document virtualizes *rendering*; this section virtualizes *loading*, and
the two compose naturally (a renderer's active window drives which pages
`loadPartial` is asked to materialize next).

## 10. Integrity Validation and Corruption Handling

```typescript
interface IntegrityBlock {
  documentChecksum: string;       // hash over the canonical serialized `document` bytes
  algorithm: "sha256";
  signedBy?: string;               // optional, for future signed-document scenarios
}
```

Load sequence, extending Engine-Lifecycle.md Section 4.3 with an integrity
step inserted **before** schema migration:

```
1. Envelope structural check   (formatId matches, envelopeVersion recognized)
2. Integrity check             (recompute documentChecksum, compare)
3. Schema version check + migration   (Domain-Model.md Principle 9)
4. Widget data migration       (Widget-System.md Section 10)
5. Structural validation       (Domain-Model.md Section 12)
6. Store hydration
```

**Corruption handling policy:**

- A `formatId` mismatch or unrecognized `envelopeVersion` fails immediately
  with a typed `UnrecognizedFormatError` — no partial parse attempt.
- An integrity checksum mismatch fails with a typed `IntegrityCheckFailedError`
  but the engine still *attempts* Section 12's best-effort structural
  recovery only if the caller explicitly opts in (`{ allowCorrupted: true
  }`) — silent recovery from a failed integrity check is never the default,
  since presenting recovered-but-possibly-wrong content as if it were intact
  is worse than a clear failure.
- A structural validation failure (Step 5) that is **partial** (e.g., 3 out
  of 400 widgets reference a nonexistent `pageId`) triggers the recovery
  path in Section 12 rather than an automatic hard failure, because a large
  presentation losing 3 widgets to quarantine is a materially better outcome
  than losing the entire document.

## 11. Best-Effort Recovery for Partially Corrupted Documents

```typescript
interface LoadResult {
  session: DocumentSession | null;
  warnings: RecoveryWarning[];
  quarantinedWidgetIds: WidgetId[];   // structurally invalid, excluded from the live Store
  quarantinedRaw: Record<WidgetId, unknown>;  // preserved as-is, for potential manual recovery/export
}
```

Widgets that fail structural or plugin validation (Domain-Model.md Section
12) are **quarantined, not silently deleted** — they are excluded from the
live, editable Store but their raw serialized form is preserved in
`quarantinedRaw` and re-emitted verbatim if the document is saved again
without modification to that widget, so a corruption in one plugin's data
never causes permanent data loss for the rest of the document, and never
gets destructively "fixed" by a save the user didn't ask for.

**Dangling references to quarantined IDs (clarified 1.1.0):** for
validation of the remaining live document, references to a quarantined
widget are treated as absent — a live widget whose `parentId` points at a
quarantined widget is reparented to `null` (top level) *in the live Store
only*, with a `RecoveryWarning` recorded; the persisted form of both
widgets is unchanged. Derived order caches simply omit quarantined IDs
(they are rebuilt from live entities, Domain-Model.md §3).

## 12. Snapshots

A **Snapshot** is a canonical envelope captured at a specific point in time,
used for: autosave history, explicit version checkpoints, and as the
replay/collaboration baseline (Command-System.md Section 17, Event-System.md
Section 13). Snapshots are immutable once created — this mirrors tldraw's
snapshot model, where a snapshot is a full, self-contained serialization of
store state that can be handed to `loadSnapshot()` independent of the live
editor session that produced it [web:180][web:184].

```typescript
interface Snapshot {
  envelope: CanonicalDocumentEnvelope;
  capturedAt: string;         // informational only, not used for ordering logic
  reason: "autosave" | "checkpoint" | "pre-collab-sync" | "manual";
}
```

Taking a snapshot never blocks the editing session — it reads the current
`Store` state (Domain-Model.md's structural sharing, Principle 3, makes
this cheap: an unchanged widget's object reference is shared between the
live Store and the snapshot, not deep-copied) and serializes asynchronously
off the interaction hot path.

## 13. Incremental Saving

Rather than re-serializing the entire document on every save, the engine
supports **diff-based incremental persistence**, built directly on
Command-System.md's existing guarantee that every committed Transaction
produces a `DocumentChangedEvent` diff (Event-System.md Section 8):

```typescript
interface IncrementalSaveOp {
  baseSnapshotId: string;
  changedWidgetIds: WidgetId[];
  changedPageIds: PageId[];
  removedWidgetIds: WidgetId[];   // added 1.1.0 — Partial<> cannot express
  removedPageIds: PageId[];       // removal; without explicit removal sets,
  removedAssetIds: AssetId[];     // deleted content was silently resurrected
  patch: Partial<PresentationDocument>;   // upserts only — the changed/added slice
}
```

**Semantics (clarified 1.1.0):** applying an op = upsert every entity in
`patch`, then delete every entity in the `removed*` sets. Both derive from
the same transaction ChangeSet (State-Management.md §5); an op is never
hand-assembled.

A storage provider may choose to persist `IncrementalSaveOp`s
append-only (cheap, fast) and periodically consolidate them into a fresh
full `Snapshot` (Section 12) — this consolidation *strategy* is a storage
provider decision, not an engine-enforced policy; the engine's only
obligation is producing correct, minimal diffs, which it already does via
the Transaction Manager's existing change-tracking (Command-System.md
Section 19).

## 14. Autosave

Autosave is **not a separate serialization mechanism** — it is a scheduling
policy (Engine-Lifecycle.md Section 6.16's Scheduler) that periodically
triggers Section 13's incremental save path, debounced against the same
Command-merging behavior already used for interactive edits
(Command-System.md Section 19). The engine exposes a subscription point
(`onAutosaveDue`) rather than an autosave implementation — actually writing
bytes to disk/network is a storage-provider concern (Principle 11), fully
consistent with the "no I/O in the core" rule.

## 15. Versioning, Schema Migration, Forward and Backward Compatibility

This section is the persistence-specific application of Domain-Model.md
Principle 9, made precise:

- **Backward compatibility (old file, new engine):** every `schemaVersion`
  increment ships with a migration function
  `migrate(doc, fromVersion) -> doc'` (Domain-Model.md Section 9's pattern,
  restated here as the load-time entry point, Section 10 step 3). Migrations
  are chained — loading a `schemaVersion: 1` document into a
  `schemaVersion: 5`-current engine runs migrations 1→2→3→4→5 in sequence,
  never a single "jump" migration, so each version transition stays small,
  testable, and independently reviewable — the same incremental philosophy
  behind tldraw's per-version `createMigrationSequence` pattern, where each
  migration step is registered under a stable sequence ID and applied in
  order [web:189].
- **Forward compatibility (new file, old engine):** an older engine
  encountering a newer `schemaVersion` it doesn't recognize **fails
  loudly** with a typed `UnsupportedSchemaVersionError` rather than
  attempting a guess-based partial parse — silent forward-compat "best
  effort" parsing is explicitly rejected as a strategy, because guessing
  at an unknown future schema risks silent data corruption far worse than a
  clear "please update the engine" error.
- **Widget-level versioning is independent** (Widget-System.md Section 3,
  Section 10) — a document's `schemaVersion` staying flat while individual
  widgets' `dataVersion`s advance is the expected, common case, not an edge
  case.
- **Envelope-level versioning is independent again** (Section 2) — three
  fully separate version axes (envelope, document schema, widget data),
  each evolving on its own cadence, each with its own migration path, never
  conflated into one "file version" number the way many legacy formats
  mistakenly do.

## 16. Collaborative Persistence vs. Local Persistence

Local persistence (Sections 12–14) operates on a **complete, closed
snapshot** — one canonical envelope, one point-in-time truth. Collaborative
persistence (future `@engine/collab`, seam fixed here, not implemented) is
structurally different: the durable record of truth becomes the **ordered
operation/Command log** (Command-System.md Section 17, Event-System.md
Section 13) plus periodic snapshots as compaction checkpoints, not a single
mutable file being repeatedly overwritten.

```
Local mode:     [Snapshot] --edit--> [Snapshot] --edit--> [Snapshot]
                (each save replaces the previous canonical file)

Collab mode:    [Baseline Snapshot] --op--> --op--> --op--> ... --op-->
                                     (periodic compaction: fold ops into a
                                      new Baseline Snapshot, log continues)
```

This distinction is why Section 12 already specifies snapshots as
immutable, content-addressable-by-`capturedAt`+`reason` objects rather than
a single mutable "the save file" concept — local mode simply treats "the
most recent snapshot" as canonical, while collab mode treats the snapshot
as one compaction point among many in an ongoing log. No change to Sections
2–15 is required to support this — collaborative persistence is an
*additional consumer* of the same `Snapshot`/`IncrementalSaveOp` primitives,
per Design-Principles.md Principle 13.

## 17. How Importers and Exporters Interact With the Canonical Format

This section is the binding contract for Import-Export.md (next document):

- **Exporters never read or write the canonical envelope directly as their
  output** — an exporter consumes a live or snapshotted
  `PresentationDocument` (via the Store's read-only accessor,
  Engine-Lifecycle.md Section 6.2) and produces bytes in a *foreign* format
  (PPTX, PDF, SVG). The canonical envelope is not "one of the export
  formats" — it is the thing exporters translate *from*.
- **Importers never write the canonical envelope directly either** — an
  importer parses a foreign format and produces a `PresentationDocument`
  value (or a set of Commands, Command-System.md Section 4's Import
  Commands row), which is then loaded into the engine through the exact
  same `engine.documents.load()` / Command Dispatcher path any other source
  uses (Engine-Lifecycle.md Section 4.3, Section 8). An importer is never
  handed the envelope format to "fill in" — it only ever produces
  domain-shaped output, and the engine's own serializer decides how that
  becomes a canonical envelope if/when it's saved.
- **Consequence:** the canonical format can evolve (a new `envelopeVersion`,
  a new asset packaging strategy) without requiring any Importer/Exporter
  adapter to change, because neither adapter type ever touches envelope
  structure directly — they touch `PresentationDocument` only, which is a
  stable dependency per Domain-Model.md's own versioning guarantees
  (Section 15).

## 18. What This Layer Explicitly Does NOT Do

- Does not decide *which* storage backend, database, or file system is used
  — `AssetStorageRef`/snapshot storage are contracts, not implementations
  (Principle 11).
- Does not perform export/import format translation — that is
  Import-Export.md's domain entirely; this document only fixes how
  Importers/Exporters interface with the canonical format (Section 17).
- Does not resolve collaboration conflicts — only fixes that collaborative
  persistence is log-shaped rather than snapshot-shaped (Section 16),
  deferring resolution mechanics to a future Collaboration.md.
- Does not mandate a specific packaging technology (ZIP, tar, or a raw
  JSON+sidecar folder) — Section 7 fixes the *shape* of the choice, not the
  choice itself.

## 19. Updated Architecture Dependency Graph

```
Vision
    │
Design Principles
    │
Architecture
    │
Engine Lifecycle
    │
    ├─────────────────────────────┐
    │                             │
Domain Model              Rendering Architecture
    │                             │
Widget System          Selection & Interaction
    │                             │
    └─────────────┬───────────────┘
                   │
             Event System
                   │
            Command System
                   │
           State Management
                   │
             Serialization   ◄── this document
                   │
   Import / Export
                   │
             Collaboration
```

Serialization sits between State Management and Import/Export: it depends
on Domain Model directly (what gets persisted) and on Command System
indirectly (incremental save diffs derive from Transaction change-tracking)
but does not depend on Import/Export — the dependency runs the other
direction (Section 17: Import/Export depends on Serialization's contract).

## 20. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.1.0 | §13 `IncrementalSaveOp` gains explicit removal sets (Partial<> cannot express deletion); §11 dangling-reference rule for quarantined widgets; §9 partial-load validation scope clarified | Readiness Review M7; State-Management.md §5 alignment |

## 21. Open Questions Deferred to Later Documents

- Exact foreign-format mapping tables (PPTX shape → Domain widget, etc.) —
  Import-Export.md.
- Exact conflict-log compaction algorithm for collaborative mode — future
  Collaboration.md.
- Concrete `RenderStateDiff`-to-`IncrementalSaveOp` derivation efficiency —
  State-Management.md (if not already finalized by the time this is
  revisited).
