import { describe, expect, it } from "vitest";
import type { ValidationResult } from "../src/index";
import { mergeValidationResults, validateDocument, validResult } from "../src/index";
import {
  acceptingWidgetDataValidator,
  fixtureDocument,
  fixturePage,
  fixtureWidget,
  rejectingWidgetDataValidator,
  stubWidgetTypeLookup,
} from "../src/testing/index";

const registry = () => stubWidgetTypeLookup({ text: acceptingWidgetDataValidator() });

const codes = (result: ValidationResult) => result.errors.map((e) => e.code);
const warningCodes = (result: ValidationResult) => result.warnings.map((e) => e.code);

describe("validateDocument — the handbook's example document", () => {
  it("accepts Domain-Model.md §13's canonical document", () => {
    const result = validateDocument(fixtureDocument(), registry());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("accepts it with derived-cache checking enabled too", () => {
    const result = validateDocument(fixtureDocument(), registry(), { checkDerivedCaches: true });
    expect(result.valid).toBe(true);
  });
});

describe("validateDocument — referential integrity (Domain-Model.md §12)", () => {
  it("rejects a widget on a page that does not exist", () => {
    const doc = fixtureDocument({
      widgets: { widget_1: fixtureWidget({ pageId: "page_missing" }) },
    });
    expect(codes(validateDocument(doc, registry()))).toContain("unknown-page-reference");
  });

  it("rejects a widget whose parent does not exist", () => {
    const doc = fixtureDocument({
      widgets: { widget_1: fixtureWidget({ parentId: "group_missing" }) },
    });
    expect(codes(validateDocument(doc, registry()))).toContain("unknown-parent-reference");
  });

  it("rejects a parent on a different page", () => {
    const doc = fixtureDocument({
      pages: { page_1: fixturePage(), page_2: fixturePage({ id: "page_2", order: "a1" }) },
      widgets: {
        group_1: fixtureWidget({ id: "group_1", type: "text", pageId: "page_2" }),
        widget_1: fixtureWidget({ id: "widget_1", parentId: "group_1", pageId: "page_1" }),
      },
    });
    expect(codes(validateDocument(doc, registry()))).toContain("parent-on-other-page");
  });

  it("rejects a map keyed by anything but the entity's own id", () => {
    const doc = fixtureDocument({
      widgets: { wrong_key: fixtureWidget({ id: "widget_1" }) },
    });
    expect(codes(validateDocument(doc, registry()))).toContain("entity-id-mismatch");
  });

  it("rejects a parent cycle without hanging", () => {
    const doc = fixtureDocument({
      widgets: {
        a: fixtureWidget({ id: "a", parentId: "b" }),
        b: fixtureWidget({ id: "b", parentId: "a" }),
      },
    });
    expect(codes(validateDocument(doc, registry()))).toContain("parent-cycle");
  });

  it("rejects a widget that is its own parent", () => {
    const doc = fixtureDocument({ widgets: { a: fixtureWidget({ id: "a", parentId: "a" }) } });
    expect(codes(validateDocument(doc, registry()))).toContain("parent-cycle");
  });

  it("rejects an unknown asset in a page background", () => {
    const doc = fixtureDocument({
      pages: {
        page_1: fixturePage({
          background: { type: "asset", assetId: "asset_missing", fit: "cover" },
        }),
      },
    });
    expect(codes(validateDocument(doc, registry()))).toContain("unknown-asset-reference");
  });

  it("rejects an unknown theme token in a page background", () => {
    const doc = fixtureDocument({
      pages: {
        page_1: fixturePage({
          background: { type: "color", color: { type: "theme", token: "brand-primary" } },
        }),
      },
    });
    expect(codes(validateDocument(doc, registry()))).toContain("unknown-theme-reference");
  });

  it("accepts a theme token that a registered theme defines", () => {
    const doc = fixtureDocument({
      themes: {
        theme_1: {
          id: "theme_1",
          name: "Default",
          colorTokens: { "brand-primary": "#123456" },
          typography: { fontFamilies: {}, scale: {} },
          spacingUnit: 8,
        },
      },
      pages: {
        page_1: fixturePage({
          background: { type: "color", color: { type: "theme", token: "brand-primary" } },
        }),
      },
    });
    expect(validateDocument(doc, registry()).valid).toBe(true);
  });

  it("rejects a schemaVersion that is not current", () => {
    const doc = fixtureDocument({ schemaVersion: 99 });
    expect(codes(validateDocument(doc, registry()))).toContain("unsupported-schema-version");
  });
});

describe("validateDocument — the delegation boundary (Domain-Model.md §12)", () => {
  it("rejects a widget type with no registered definition", () => {
    const doc = fixtureDocument({ widgets: { widget_1: fixtureWidget({ type: "chart" }) } });
    const result = validateDocument(doc, stubWidgetTypeLookup({}));
    expect(codes(result)).toContain("unregistered-widget-type");
  });

  it("surfaces a widget validator's errors in document coordinates", () => {
    const doc = fixtureDocument();
    const result = validateDocument(
      doc,
      stubWidgetTypeLookup({ text: rejectingWidgetDataValidator("runs must not be empty") }),
    );
    expect(result.valid).toBe(false);
    const [first] = result.errors;
    expect(first?.code).toBe("widget-data-invalid");
    expect(first?.message).toBe("runs must not be empty");
    expect(first?.path).toEqual(["widgets", "widget_1", "data"]);
    expect(first?.entityId).toBe("widget_1");
    expect(first?.widgetType).toBe("text");
  });

  it("never inspects widget data itself", () => {
    // The canonical document's data is a text run structure the core knows
    // nothing about. With an accepting validator it must pass; with a rejecting
    // one it must fail. The core's own verdict is identical either way, which is
    // the boundary Design Principle 6 requires.
    const doc = fixtureDocument({
      widgets: { widget_1: fixtureWidget({ data: { nonsense: 1 } }) },
    });
    expect(validateDocument(doc, registry()).valid).toBe(true);
    expect(
      validateDocument(doc, stubWidgetTypeLookup({ text: rejectingWidgetDataValidator() })).valid,
    ).toBe(false);
  });

  it("warns, but does not fail, when widgetDefinitionRefs omits a used type", () => {
    const doc = fixtureDocument({ widgetDefinitionRefs: [] });
    const result = validateDocument(doc, registry());
    expect(warningCodes(result)).toContain("unknown-widget-type");
    expect(result.valid).toBe(true);
  });
});

describe("validateDocument — derived caches (Domain-Model.md §3)", () => {
  it("ignores stale caches unless asked", () => {
    const doc = fixtureDocument({ pageOrder: ["nonsense"] });
    expect(validateDocument(doc, registry()).valid).toBe(true);
  });

  it("rejects a stale pageOrder when asked", () => {
    const doc = fixtureDocument({ pageOrder: [] });
    const result = validateDocument(doc, registry(), { checkDerivedCaches: true });
    expect(codes(result)).toContain("derived-cache-stale");
  });

  it("rejects a stale widgetOrder when asked", () => {
    const doc = fixtureDocument({
      pages: { page_1: fixturePage({ widgetOrder: ["widget_1", "ghost"] }) },
    });
    const result = validateDocument(doc, registry(), { checkDerivedCaches: true });
    expect(codes(result)).toContain("derived-cache-stale");
  });
});

describe("result composition", () => {
  it("validResult is the identity", () => {
    expect(validResult()).toEqual({ valid: true, errors: [], warnings: [] });
    expect(mergeValidationResults(validResult(), validResult())).toEqual(validResult());
  });

  it("merging keeps valid in step with errors", () => {
    const bad: ValidationResult = {
      valid: false,
      errors: [{ code: "parent-cycle", message: "x", path: [] }],
      warnings: [],
    };
    const merged = mergeValidationResults(validResult(), bad);
    expect(merged.valid).toBe(false);
    expect(merged.errors).toHaveLength(1);
  });

  it("merging nothing is valid", () => {
    expect(mergeValidationResults()).toEqual(validResult());
  });
});
