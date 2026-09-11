import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { PresentationDocument, ValidationIssueCode } from "../../src/index";
import { validateDocument } from "../../src/index";
import {
  acceptingWidgetDataValidator,
  fixtureDocument,
  fixturePage,
  fixtureWidget,
  stubWidgetTypeLookup,
} from "../../src/testing/index";

/**
 * Testing-Strategy.md §5 row P3 — `validateDocument` accepts every well-formed
 * generated document and rejects every injected referential-integrity
 * violation.
 *
 * The generators build structurally valid documents of varied shape (several
 * pages, nested groups, widgets spread across pages) rather than minimal ones,
 * because a generator that only ever emits the canonical two-entity document
 * would make this row vacuous.
 */

const registry = stubWidgetTypeLookup({ text: acceptingWidgetDataValidator() });

/** A well-formed document: n pages, each with widgets, some nested in groups. */
const wellFormedDocument = fc
  .record({
    pageCount: fc.integer({ min: 1, max: 5 }),
    widgetsPerPage: fc.integer({ min: 0, max: 6 }),
    groupEvery: fc.integer({ min: 2, max: 4 }),
  })
  .map(({ pageCount, widgetsPerPage, groupEvery }): PresentationDocument => {
    const pages: Record<string, ReturnType<typeof fixturePage>> = {};
    const widgets: Record<string, ReturnType<typeof fixtureWidget>> = {};

    for (let p = 0; p < pageCount; p += 1) {
      const pageId = `page_${p}`;
      const onThisPage: string[] = [];
      let lastGroupId: string | null = null;

      for (let w = 0; w < widgetsPerPage; w += 1) {
        const widgetId = `widget_${p}_${w}`;
        const isGroup = w % groupEvery === 0;
        const parentId = isGroup ? null : lastGroupId;
        widgets[widgetId] = fixtureWidget({
          id: widgetId,
          pageId,
          parentId,
          order: `a${w}`,
          type: "text",
        });
        if (isGroup) {
          lastGroupId = widgetId;
        }
        if (parentId === null) {
          onThisPage.push(widgetId);
        }
      }

      pages[pageId] = fixturePage({
        id: pageId,
        order: `a${p}`,
        widgetOrder: onThisPage,
      });
    }

    return fixtureDocument({
      pages,
      widgets,
      pageOrder: Object.keys(pages),
      widgetDefinitionRefs: ["text"],
    });
  });

describe("P3 — accepts every well-formed document", () => {
  it("holds across varied page and group structures", () => {
    fc.assert(
      fc.property(wellFormedDocument, (doc) => {
        const result = validateDocument(doc, registry, { checkDerivedCaches: true });
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
      }),
    );
  });
});

describe("P3 — rejects every injected referential-integrity violation", () => {
  /** Each mutation breaks exactly one documented invariant. */
  const breakages: {
    readonly name: string;
    readonly code: ValidationIssueCode;
    readonly apply: (doc: PresentationDocument) => PresentationDocument | null;
  }[] = [
    {
      name: "widget points at a missing page",
      code: "unknown-page-reference",
      apply: (doc) => {
        const [id] = Object.keys(doc.widgets);
        if (id === undefined) return null;
        const widget = doc.widgets[id];
        if (widget === undefined) return null;
        return { ...doc, widgets: { ...doc.widgets, [id]: { ...widget, pageId: "page_gone" } } };
      },
    },
    {
      name: "widget points at a missing parent",
      code: "unknown-parent-reference",
      apply: (doc) => {
        const [id] = Object.keys(doc.widgets);
        if (id === undefined) return null;
        const widget = doc.widgets[id];
        if (widget === undefined) return null;
        return {
          ...doc,
          widgets: { ...doc.widgets, [id]: { ...widget, parentId: "parent_gone" } },
        };
      },
    },
    {
      name: "map key disagrees with the entity id",
      code: "entity-id-mismatch",
      apply: (doc) => {
        const [id] = Object.keys(doc.widgets);
        if (id === undefined) return null;
        const widget = doc.widgets[id];
        if (widget === undefined) return null;
        const { [id]: _removed, ...rest } = doc.widgets;
        return { ...doc, widgets: { ...rest, moved_key: widget } };
      },
    },
    {
      name: "parent chain forms a cycle",
      code: "parent-cycle",
      apply: (doc) => {
        const ids = Object.keys(doc.widgets);
        const [first, second] = ids;
        if (first === undefined || second === undefined) return null;
        const a = doc.widgets[first];
        const b = doc.widgets[second];
        if (a === undefined || b === undefined) return null;
        return {
          ...doc,
          widgets: {
            ...doc.widgets,
            [first]: { ...a, parentId: second, pageId: b.pageId },
            [second]: { ...b, parentId: first },
          },
        };
      },
    },
    {
      name: "parent sits on a different page",
      code: "parent-on-other-page",
      apply: (doc) => {
        const otherPageId = "page_elsewhere";
        const child = Object.values(doc.widgets).find((w) => w.parentId !== null);
        if (child === undefined) return null;
        return {
          ...doc,
          pages: { ...doc.pages, [otherPageId]: fixturePage({ id: otherPageId, order: "z0" }) },
          widgets: { ...doc.widgets, [child.id]: { ...child, pageId: otherPageId } },
        };
      },
    },
    {
      name: "schemaVersion is from the future",
      code: "unsupported-schema-version",
      apply: (doc) => ({ ...doc, schemaVersion: doc.schemaVersion + 1 }),
    },
    {
      name: "widget type is not registered",
      code: "unregistered-widget-type",
      apply: (doc) => {
        const [id] = Object.keys(doc.widgets);
        if (id === undefined) return null;
        const widget = doc.widgets[id];
        if (widget === undefined) return null;
        return { ...doc, widgets: { ...doc.widgets, [id]: { ...widget, type: "not-registered" } } };
      },
    },
  ];

  for (const breakage of breakages) {
    it(`detects: ${breakage.name}`, () => {
      // Some generated documents have nothing to break (zero widgets, or no
      // nested widget). Those runs are skipped, so the count is asserted
      // afterwards: a breakage that never actually applied would make this
      // property vacuously true, which is worse than a failing test.
      let applied = 0;
      fc.assert(
        fc.property(wellFormedDocument, (doc) => {
          const broken = breakage.apply(doc);
          if (broken === null) {
            return;
          }
          applied += 1;
          const result = validateDocument(broken, registry, { checkDerivedCaches: false });
          expect(result.valid).toBe(false);
          expect(result.errors.map((e) => e.code)).toContain(breakage.code);
        }),
      );
      expect(applied).toBeGreaterThan(0);
    });
  }
});

describe("P3 — the result contract holds unconditionally", () => {
  it("valid is true if and only if errors is empty", () => {
    fc.assert(
      fc.property(wellFormedDocument, fc.boolean(), (doc, checkCaches) => {
        const result = validateDocument(doc, registry, { checkDerivedCaches: checkCaches });
        expect(result.valid).toBe(result.errors.length === 0);
      }),
    );
  });

  it("every issue carries a code, a message and a path", () => {
    fc.assert(
      fc.property(wellFormedDocument, (doc) => {
        const broken = { ...doc, schemaVersion: 42, widgetDefinitionRefs: [] };
        const result = validateDocument(broken, registry);
        for (const issue of [...result.errors, ...result.warnings]) {
          expect(issue.code).toBeTruthy();
          expect(issue.message).toBeTruthy();
          expect(Array.isArray(issue.path)).toBe(true);
        }
      }),
    );
  });

  it("terminates on a fully cyclic document rather than hanging", () => {
    const cyclic = fixtureDocument({
      widgets: {
        a: fixtureWidget({ id: "a", parentId: "c" }),
        b: fixtureWidget({ id: "b", parentId: "a" }),
        c: fixtureWidget({ id: "c", parentId: "b" }),
      },
      pages: { page_1: fixturePage({ widgetOrder: [] }) },
    });
    const result = validateDocument(cyclic, registry);
    expect(result.errors.map((e) => e.code)).toContain("parent-cycle");
  });
});
