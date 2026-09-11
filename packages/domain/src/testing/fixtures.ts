/**
 * Pure document fixture builders — ADR-0012.
 *
 * Every builder returns a complete, valid value and takes overrides, so a test
 * states only what it cares about (Testing-Strategy.md §10). No randomness, no
 * clock reads: a fixture is the same value on every run.
 */

import type { PresentationDocument } from "../document.js";
import type { PageId, WidgetId } from "../ids.js";
import { compareOrdered } from "../ordering.js";
import type { Page } from "../page.js";
import type { SerializedPage, SerializedPresentationDocument } from "../serialized.js";
import type { WidgetInstance } from "../widget.js";

/**
 * Domain-Model.md §13's canonical minimal valid document, verbatim.
 *
 * Typed as the *serialized* shape because §13 is labelled "canonical
 * serialized form — derived caches absent". Frozen so a test cannot mutate the
 * shared canonical value out from under another test.
 */
export const CANONICAL_DOCUMENT: SerializedPresentationDocument = Object.freeze({
  id: "doc_1",
  schemaVersion: 1,
  metadata: Object.freeze({
    title: "Untitled",
    createdAt: "2026-07-12T00:00:00Z",
    updatedAt: "2026-07-12T00:00:00Z",
  }),
  canvas: Object.freeze({
    unit: "engine-unit" as const,
    defaultPageSize: Object.freeze({ width: 1280, height: 720 }),
    defaultPageOrientation: "landscape" as const,
  }),
  assets: Object.freeze({}),
  themes: Object.freeze({}),
  widgetDefinitionRefs: Object.freeze(["text"]) as string[],
  pages: Object.freeze({
    page_1: Object.freeze({
      id: "page_1",
      order: "a0",
      name: "Page 1",
      size: Object.freeze({ width: 1280, height: 720 }),
      background: Object.freeze({
        type: "color" as const,
        color: Object.freeze({ type: "static" as const, value: "#ffffff" }),
      }),
    }),
  }),
  widgets: Object.freeze({
    widget_1: Object.freeze({
      id: "widget_1",
      pageId: "page_1",
      parentId: null,
      order: "a0",
      type: "text",
      dataVersion: 1,
      transform: Object.freeze({
        x: 100,
        y: 100,
        width: 400,
        height: 80,
        rotation: 0,
        opacity: 1,
      }),
      data: Object.freeze({ runs: [{ text: "Hello, Presentation Engine.", bold: false }] }),
    }),
  }),
});

/** A valid `SerializedPage` with `overrides` applied. */
export function fixtureSerializedPage(overrides: Partial<SerializedPage> = {}): SerializedPage {
  return {
    id: "page_1",
    order: "a0",
    name: "Page 1",
    size: { width: 1280, height: 720 },
    background: { type: "color", color: { type: "static", value: "#ffffff" } },
    ...overrides,
  };
}

/**
 * A valid live `Page` with `overrides` applied. Unlike the serialized form
 * this carries `widgetOrder`, the runtime-only derived cache
 * (Domain-Model.md §3).
 */
export function fixturePage(overrides: Partial<Page> = {}): Page {
  return { ...fixtureSerializedPage(), widgetOrder: [], ...overrides };
}

/** A valid `WidgetInstance` with `overrides` applied. */
export function fixtureWidget(overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return {
    id: "widget_1",
    pageId: "page_1",
    parentId: null,
    order: "a0",
    type: "text",
    dataVersion: 1,
    transform: { x: 100, y: 100, width: 400, height: 80, rotation: 0, opacity: 1 },
    data: {},
    ...overrides,
  };
}

/** The canonical document in its serialized form, with `overrides` applied. */
export function fixtureSerializedDocument(
  overrides: Partial<SerializedPresentationDocument> = {},
): SerializedPresentationDocument {
  return {
    ...CANONICAL_DOCUMENT,
    metadata: { ...CANONICAL_DOCUMENT.metadata },
    canvas: { ...CANONICAL_DOCUMENT.canvas },
    pages: { ...CANONICAL_DOCUMENT.pages },
    widgets: { ...CANONICAL_DOCUMENT.widgets },
    widgetDefinitionRefs: [...CANONICAL_DOCUMENT.widgetDefinitionRefs],
    ...overrides,
  };
}

/**
 * The canonical document as a **live** value, with derived caches populated
 * the way the Store would rebuild them on hydration
 * (Domain-Model.md §3; State-Management.md §3).
 *
 * The rebuild uses the real `compareOrdered` comparator — Ordering-Strategy.md's
 * order-then-id total order. The Store owns the real *incremental*
 * maintenance; this is a fixture, not that implementation.
 */
export function fixtureDocument(
  overrides: Partial<PresentationDocument> = {},
): PresentationDocument {
  const serialized = fixtureSerializedDocument();

  const pages: Record<PageId, Page> = {};
  for (const page of Object.values(serialized.pages)) {
    const topLevel = Object.values(serialized.widgets)
      .filter((w: WidgetInstance) => w.pageId === page.id && w.parentId === null)
      .sort(compareOrdered)
      .map((w: WidgetInstance) => w.id);
    pages[page.id] = { ...page, widgetOrder: topLevel };
  }

  const pageOrder = Object.values(serialized.pages)
    .sort(compareOrdered)
    .map((p) => p.id);
  const widgets: Record<WidgetId, WidgetInstance> = { ...serialized.widgets };

  return { ...serialized, pages, pageOrder, widgets, ...overrides };
}
