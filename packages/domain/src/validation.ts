/**
 * Structural validation — Domain-Model.md §12.
 *
 * The core owns exactly one generic validation entry point. It checks the
 * structural invariants Ring 0 knows about — that every reference resolves, no
 * widget is orphaned, `schemaVersion` is one this engine understands — and
 * delegates `data` validation to each widget's own validator without ever
 * inspecting `data` itself. That boundary is what lets the core stay genuinely
 * ignorant of widget internals while the document as a whole is still fully
 * validated (Design Principle 6).
 *
 * Issues accumulate; they are not thrown. A caller needs every problem in a
 * document at once in order to report or quarantine them
 * (Serialization.md §11), not just the first. Throwing is reserved for the
 * fail-loud cases in Engine-Lifecycle.md §9.
 *
 * Whole-document validation of this kind runs at load and import only. Per-
 * transaction validation is incremental and O(what-the-transaction-touched)
 * (ADR-0003), and belongs to `presentation-state`.
 */

import type { PresentationDocument } from "./document.js";
import type { EntityId, WidgetTypeId } from "./ids.js";
import { CURRENT_SCHEMA_VERSION } from "./migration.js";
import { compareOrdered } from "./ordering.js";

/** Stable, machine-readable issue codes. Messages are for humans; these are for code. */
export type ValidationIssueCode =
  | "unsupported-schema-version"
  | "entity-id-mismatch"
  | "unknown-page-reference"
  | "unknown-parent-reference"
  | "parent-cycle"
  | "parent-on-other-page"
  | "unknown-widget-type"
  | "unregistered-widget-type"
  | "widget-data-invalid"
  | "unknown-asset-reference"
  | "unknown-theme-reference"
  | "derived-cache-stale";

/** One problem found in a document, located precisely enough to act on. */
export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  /** Location within the document, e.g. `["widgets", "widget_1", "pageId"]`. */
  path: string[];
  entityId?: EntityId;
  /** Set when the issue came from a widget's own validator. */
  widgetType?: WidgetTypeId;
}

/** Domain-Model.md §12. `valid` is true if and only if `errors` is empty. */
export interface ValidationResult {
  valid: boolean;
  /** Blocking: the document or data is not usable as-is. */
  errors: ValidationIssue[];
  /** Non-blocking: recoverable or advisory. */
  warnings: ValidationIssue[];
}

/**
 * What validation consumes from a widget definition (ADR-0013).
 *
 * Ring 0 cannot reference `WidgetDefinition` — that contract is
 * `presentation-widget-api`'s, Ring 2 — so this states the requirement and the
 * real definition satisfies it structurally.
 */
export interface WidgetDataValidator {
  validate(data: unknown): ValidationResult;
}

/** What validation consumes from the widget registry (ADR-0013). */
export interface WidgetTypeLookup {
  get(type: WidgetTypeId): WidgetDataValidator | undefined;
}

/** Options for `validateDocument`. */
export interface ValidateDocumentOptions {
  /**
   * Check that the runtime-only derived caches agree with the `order` fields
   * they cache (Domain-Model.md §3). Off by default because a freshly
   * deserialized document has no caches yet — they are rebuilt during hydration
   * (State-Management.md §3), so this is only meaningful for a live document.
   */
  readonly checkDerivedCaches?: boolean;
}

function issue(
  code: ValidationIssueCode,
  message: string,
  path: string[],
  extra: { entityId?: EntityId; widgetType?: WidgetTypeId } = {},
): ValidationIssue {
  return extra.widgetType !== undefined
    ? { code, message, path, ...extra, widgetType: extra.widgetType }
    : { code, message, path, ...extra };
}

/**
 * Validate a whole document's structure, delegating widget `data` to the
 * registry's validators.
 *
 * @param doc the document to check
 * @param registry the widget type lookup; the engine's `WidgetRegistry`
 *   satisfies this port structurally (ADR-0013)
 */
export function validateDocument(
  doc: PresentationDocument,
  registry: WidgetTypeLookup,
  options: ValidateDocumentOptions = {},
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (doc.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push(
      issue(
        "unsupported-schema-version",
        `schemaVersion ${doc.schemaVersion} is not ${CURRENT_SCHEMA_VERSION}; migrate before validating`,
        ["schemaVersion"],
      ),
    );
  }

  // Every flat map is keyed by the entity's own id (Design Principle 3). A
  // mismatch silently breaks every lookup in the engine, so it is an error, not
  // a warning.
  for (const [key, page] of Object.entries(doc.pages)) {
    if (page.id !== key) {
      errors.push(
        issue("entity-id-mismatch", `pages["${key}"] has id "${page.id}"`, ["pages", key, "id"], {
          entityId: page.id,
        }),
      );
    }
    validateBackgroundReferences(doc, page.id, errors);
  }

  for (const [key, widget] of Object.entries(doc.widgets)) {
    if (widget.id !== key) {
      errors.push(
        issue(
          "entity-id-mismatch",
          `widgets["${key}"] has id "${widget.id}"`,
          ["widgets", key, "id"],
          {
            entityId: widget.id,
          },
        ),
      );
    }

    if (doc.pages[widget.pageId] === undefined) {
      errors.push(
        issue(
          "unknown-page-reference",
          `widget "${widget.id}" references unknown page "${widget.pageId}"`,
          ["widgets", key, "pageId"],
          { entityId: widget.id },
        ),
      );
    }

    if (widget.parentId !== null) {
      const parent = doc.widgets[widget.parentId];
      if (parent === undefined) {
        errors.push(
          issue(
            "unknown-parent-reference",
            `widget "${widget.id}" references unknown parent "${widget.parentId}"`,
            ["widgets", key, "parentId"],
            { entityId: widget.id },
          ),
        );
      } else if (parent.pageId !== widget.pageId) {
        // Grouping is a flat reference (Domain-Model.md §5), but a group and its
        // members still have to live on one page or paint order is undefined.
        errors.push(
          issue(
            "parent-on-other-page",
            `widget "${widget.id}" is on page "${widget.pageId}" but its parent "${parent.id}" is on "${parent.pageId}"`,
            ["widgets", key, "parentId"],
            { entityId: widget.id },
          ),
        );
      }
    }

    if (!doc.widgetDefinitionRefs.includes(widget.type)) {
      // The document declares which plugins it depends on (Domain-Model.md §3).
      // A widget whose type is absent from that list still loads, but the
      // declaration is wrong — advisory rather than blocking.
      warnings.push(
        issue(
          "unknown-widget-type",
          `widget "${widget.id}" has type "${widget.type}", absent from widgetDefinitionRefs`,
          ["widgets", key, "type"],
          { entityId: widget.id, widgetType: widget.type },
        ),
      );
    }

    const definition = registry.get(widget.type);
    if (definition === undefined) {
      errors.push(
        issue(
          "unregistered-widget-type",
          `no widget definition registered for type "${widget.type}"`,
          ["widgets", key, "type"],
          { entityId: widget.id, widgetType: widget.type },
        ),
      );
      continue;
    }

    // The core delegates and never looks inside `data` (Domain-Model.md §12).
    const dataResult = definition.validate(widget.data);
    for (const dataIssue of dataResult.errors) {
      errors.push(rehomeWidgetIssue(dataIssue, key, widget.id, widget.type));
    }
    for (const dataIssue of dataResult.warnings) {
      warnings.push(rehomeWidgetIssue(dataIssue, key, widget.id, widget.type));
    }
  }

  detectParentCycles(doc, errors);

  if (options.checkDerivedCaches === true) {
    validateDerivedCaches(doc, errors);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Re-home a widget validator's issue into document coordinates, so a caller
 * gets one flat list it can act on rather than a tree it has to walk.
 */
function rehomeWidgetIssue(
  original: ValidationIssue,
  key: string,
  entityId: EntityId,
  widgetType: WidgetTypeId,
): ValidationIssue {
  return {
    ...original,
    code: "widget-data-invalid",
    message: original.message,
    path: ["widgets", key, "data", ...original.path],
    entityId,
    widgetType,
  };
}

function validateBackgroundReferences(
  doc: PresentationDocument,
  pageId: EntityId,
  errors: ValidationIssue[],
): void {
  const page = doc.pages[pageId];
  if (page === undefined) {
    return;
  }
  const { background } = page;
  if (background.type === "asset" && doc.assets[background.assetId] === undefined) {
    errors.push(
      issue(
        "unknown-asset-reference",
        `page "${pageId}" background references unknown asset "${background.assetId}"`,
        ["pages", pageId, "background", "assetId"],
        { entityId: pageId },
      ),
    );
  }
  const themed =
    background.type === "color"
      ? [background.color]
      : background.type === "gradient"
        ? background.stops.map((stop) => stop.color)
        : [];
  for (const color of themed) {
    if (color.type === "theme" && !hasThemeToken(doc, color.token)) {
      errors.push(
        issue(
          "unknown-theme-reference",
          `page "${pageId}" background references unknown theme token "${color.token}"`,
          ["pages", pageId, "background"],
          { entityId: pageId },
        ),
      );
    }
  }
}

function hasThemeToken(doc: PresentationDocument, token: string): boolean {
  for (const theme of Object.values(doc.themes)) {
    if (Object.hasOwn(theme.colorTokens, token)) {
      return true;
    }
  }
  return false;
}

/**
 * A `parentId` chain must terminate. Grouping is a flat reference
 * (Domain-Model.md §5), so nothing structurally prevents a cycle, and a cycle
 * would hang every tree walk in the engine.
 */
function detectParentCycles(doc: PresentationDocument, errors: ValidationIssue[]): void {
  const settled = new Set<EntityId>();
  for (const widget of Object.values(doc.widgets)) {
    if (settled.has(widget.id)) {
      continue;
    }
    const seen = new Set<EntityId>();
    let current: EntityId | null = widget.id;
    while (current !== null && !settled.has(current)) {
      if (seen.has(current)) {
        errors.push(
          issue(
            "parent-cycle",
            `widget "${current}" is its own ancestor`,
            ["widgets", current, "parentId"],
            {
              entityId: current,
            },
          ),
        );
        break;
      }
      seen.add(current);
      current = doc.widgets[current]?.parentId ?? null;
    }
    for (const id of seen) {
      settled.add(id);
    }
  }
}

/**
 * Derived caches must agree with the `order` fields they cache
 * (Domain-Model.md §3). Only meaningful for a live document — see
 * `ValidateDocumentOptions.checkDerivedCaches`.
 */
function validateDerivedCaches(doc: PresentationDocument, errors: ValidationIssue[]): void {
  const expectedPageOrder = Object.values(doc.pages)
    .sort(compareOrdered)
    .map((page) => page.id);
  if (!sameSequence(doc.pageOrder, expectedPageOrder)) {
    errors.push(
      issue("derived-cache-stale", "pageOrder disagrees with the pages' order fields", [
        "pageOrder",
      ]),
    );
  }

  for (const page of Object.values(doc.pages)) {
    const expected = Object.values(doc.widgets)
      .filter((widget) => widget.pageId === page.id && widget.parentId === null)
      .sort(compareOrdered)
      .map((widget) => widget.id);
    if (!sameSequence(page.widgetOrder, expected)) {
      errors.push(
        issue(
          "derived-cache-stale",
          `page "${page.id}" widgetOrder disagrees with its top-level widgets' order fields`,
          ["pages", page.id, "widgetOrder"],
          { entityId: page.id },
        ),
      );
    }
  }
}

function sameSequence(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((id, index) => id === expected[index]);
}

/** A result with no issues — the identity for validation composition. */
export function validResult(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/** Merge results, preserving the `valid` ⟺ `errors.length === 0` invariant. */
export function mergeValidationResults(...results: readonly ValidationResult[]): ValidationResult {
  const errors = results.flatMap((result) => result.errors);
  const warnings = results.flatMap((result) => result.warnings);
  return { valid: errors.length === 0, errors, warnings };
}
