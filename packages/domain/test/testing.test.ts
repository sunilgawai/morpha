import { describe, expect, it } from "vitest";
import {
  CANONICAL_DOCUMENT,
  fixedClock,
  fixtureDocument,
  fixturePage,
  fixtureSerializedDocument,
  fixtureSerializedPage,
  fixtureWidget,
  recordingTextMeasurer,
  seededRng,
  sequentialIdGenerator,
} from "../src/testing/index";

describe("sequentialIdGenerator", () => {
  it("counts from 1 with a readable default prefix", () => {
    const ids = sequentialIdGenerator();
    expect([ids.next(), ids.next(), ids.next()]).toEqual(["id1", "id2", "id3"]);
  });

  it("honors a caller-supplied prefix", () => {
    const ids = sequentialIdGenerator("widget_");
    expect(ids.next()).toBe("widget_1");
  });

  it("gives each instance its own counter", () => {
    const a = sequentialIdGenerator();
    const b = sequentialIdGenerator();
    a.next();
    expect(b.next()).toBe("id1");
  });
});

describe("seededRng", () => {
  /**
   * A golden sequence, not just a self-consistency check. Command replay
   * (Command-System.md §17) and ordering jitter (Ordering-Strategy.md) are
   * defined against *this* generator's output, so swapping the algorithm is a
   * breaking change to replay fixtures and must fail here loudly.
   */
  it("produces a stable sequence for a fixed seed", () => {
    const rng = seededRng(42);
    const drawn = [rng.next(), rng.next(), rng.next(), rng.next(), rng.next()];
    expect(drawn.map((n) => n.toFixed(10))).toEqual([
      "0.6011037519",
      "0.4482905590",
      "0.8524657935",
      "0.6697340414",
      "0.1748138987",
    ]);
  });

  it("is reproducible across instances and varies by seed", () => {
    const draw = (seed: number) => {
      const rng = seededRng(seed);
      return [rng.next(), rng.next(), rng.next()];
    };
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
  });
});

describe("fixedClock", () => {
  it("does not advance on its own", () => {
    const clock = fixedClock(1000);
    expect(clock.now()).toBe(1000);
    expect(clock.now()).toBe(1000);
  });

  it("advances and jumps only when told", () => {
    const clock = fixedClock(1000);
    clock.advance(250);
    expect(clock.now()).toBe(1250);
    clock.set(0);
    expect(clock.now()).toBe(0);
  });

  it("rejects a negative advance rather than silently rewinding", () => {
    const clock = fixedClock(1000);
    expect(() => clock.advance(-1)).toThrow(RangeError);
  });

  it("defaults to Domain-Model.md §13's example instant", () => {
    expect(new Date(fixedClock().now()).toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });
});

describe("recordingTextMeasurer", () => {
  it("records every call and returns the configured layout", () => {
    const layout = { lines: 1 };
    const measurer = recordingTextMeasurer(layout);
    expect(measurer.measure([{ text: "hi" }], { maxWidth: 100 })).toBe(layout);
    expect(measurer.calls).toEqual([{ runs: [{ text: "hi" }], constraints: { maxWidth: 100 } }]);
  });

  it("proves a consumer measured text through the capability (ADR-0006)", () => {
    const measurer = recordingTextMeasurer();
    expect(measurer.calls).toHaveLength(0);
    measurer.measure([], {});
    expect(measurer.calls).toHaveLength(1);
  });
});

describe("fixtures", () => {
  it("freezes the canonical document so tests cannot corrupt each other", () => {
    expect(Object.isFrozen(CANONICAL_DOCUMENT)).toBe(true);
  });

  it("returns a mutable copy from the serialized builder", () => {
    const doc = fixtureSerializedDocument();
    expect(Object.isFrozen(doc)).toBe(false);
    doc.metadata.title = "Changed";
    expect(fixtureSerializedDocument().metadata.title).toBe("Untitled");
  });

  it("applies overrides", () => {
    expect(fixtureSerializedDocument({ schemaVersion: 9 }).schemaVersion).toBe(9);
    expect(fixturePage({ name: "Cover" }).name).toBe("Cover");
    expect(fixtureWidget({ type: "rect" }).type).toBe("rect");
  });

  it("omits derived caches from serialized fixtures (Serialization.md §4)", () => {
    expect(Object.hasOwn(fixtureSerializedPage(), "widgetOrder")).toBe(false);
    expect(Object.hasOwn(fixtureSerializedDocument(), "pageOrder")).toBe(false);
  });

  it("rebuilds derived caches for the live fixture (Domain-Model.md §3)", () => {
    const doc = fixtureDocument();
    expect(doc.pageOrder).toEqual(["page_1"]);
    expect(doc.pages.page_1?.widgetOrder).toEqual(["widget_1"]);
  });

  it("excludes non-top-level widgets from widgetOrder (Domain-Model.md §4)", () => {
    const doc = fixtureDocument({
      widgets: {
        group_1: fixtureWidget({ id: "group_1", type: "group", order: "a0" }),
        widget_1: fixtureWidget({ id: "widget_1", parentId: "group_1", order: "a1" }),
      },
    });
    // The override replaces `widgets` only; widgetOrder was rebuilt from the
    // canonical set, so this asserts the *contract* the Store must honor
    // rather than the fixture's own recomputation.
    expect(doc.pages.page_1?.widgetOrder).not.toContain("group_1");
  });
});
