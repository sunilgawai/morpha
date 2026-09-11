import { describe, expect, it } from "vitest";
import type { Page, PresentationDocument, SerializedPage } from "../src/index";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";
import { CANONICAL_DOCUMENT } from "../src/testing/index";

/**
 * Domain-Model.md §13's canonical example now lives on the published
 * `./testing` surface (ADR-0012) rather than being copied into this file.
 * It is typed there as the *serialized* shape, since §13 is labelled
 * "canonical serialized form — derived caches absent", so a transcription
 * that re-admitted a derived cache would stop compiling.
 */
const CANONICAL_EXAMPLE = CANONICAL_DOCUMENT;

describe("@morpha/domain package identity", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@morpha/domain");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual([]);
  });
});

describe("Domain-Model.md §13 canonical example", () => {
  it("carries no derived cache in the serialized form (Serialization.md §4)", () => {
    expect(Object.hasOwn(CANONICAL_EXAMPLE, "pageOrder")).toBe(false);
    for (const page of Object.values(CANONICAL_EXAMPLE.pages)) {
      expect(Object.hasOwn(page, "widgetOrder")).toBe(false);
    }
  });

  it("keys every flat map by the entity's own id (Design Principle 3)", () => {
    for (const [key, page] of Object.entries(CANONICAL_EXAMPLE.pages)) {
      expect(page.id).toBe(key);
    }
    for (const [key, widget] of Object.entries(CANONICAL_EXAMPLE.widgets)) {
      expect(widget.id).toBe(key);
    }
  });

  it("resolves every widget's pageId and parentId (Domain-Model.md §12 preview)", () => {
    for (const widget of Object.values(CANONICAL_EXAMPLE.widgets)) {
      expect(CANONICAL_EXAMPLE.pages[widget.pageId]).toBeDefined();
      if (widget.parentId !== null) {
        expect(CANONICAL_EXAMPLE.widgets[widget.parentId]).toBeDefined();
      }
    }
  });
});

describe("derived caches are runtime-only by construction", () => {
  it("requires widgetOrder on a live Page", () => {
    const live: Page = {
      id: "page_1",
      order: "a0",
      name: "Page 1",
      size: { width: 1280, height: 720 },
      background: { type: "none" },
      widgetOrder: [],
    };
    expect(live.widgetOrder).toEqual([]);
  });

  it("rejects a declared widgetOrder on a SerializedPage", () => {
    const persisted: SerializedPage = {
      id: "page_1",
      order: "a0",
      name: "Page 1",
      size: { width: 1280, height: 720 },
      background: { type: "none" },
      // @ts-expect-error Serialization.md §4: a serialized page has no widgetOrder.
      widgetOrder: [],
    };
    expect(persisted.id).toBe("page_1");
  });

  it("does NOT stop a derived cache from riding along in a spread", () => {
    const live: Page = {
      id: "page_1",
      order: "a0",
      name: "Page 1",
      size: { width: 1280, height: 720 },
      background: { type: "none" },
      widgetOrder: ["widget_1"],
    };
    // Excess-property checking does not apply to spreads, so the type system
    // cannot catch this. Documented so the limit is known rather than assumed:
    // stripping derived caches at the persistence boundary is
    // Serialization.md §4's job, and needs a runtime test there (property row
    // P12), not a type.
    const persisted: SerializedPage = { ...live };
    expect(Object.hasOwn(persisted, "widgetOrder")).toBe(true);
  });

  it("requires pageOrder on a live document", () => {
    const live: PresentationDocument = {
      ...CANONICAL_EXAMPLE,
      pages: {},
      pageOrder: [],
    };
    expect(live.pageOrder).toEqual([]);
  });
});
