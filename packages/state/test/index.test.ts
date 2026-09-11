import { fixtureDocument, seededRng } from "@morpha/domain/testing";
import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("@morpha/state (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@morpha/state");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual(["@morpha/domain", "@morpha/events"]);
  });
});

/**
 * ADR-0012 end to end. `presentation-state` is Ring 1 and therefore cannot
 * import `@morpha/testing` — it sits inside that package's dependency closure.
 * It reaches fixtures through the `./testing` subpath of a package it already
 * depends on, which adds no edge to the package graph. If this import ever
 * required a new dependency, a project reference, or a depcruise exception,
 * ADR-0012's central claim would be false.
 */
describe("ADR-0012: Ring 1 consumes @morpha/domain/testing", () => {
  it("resolves the subpath across the existing state -> domain edge", () => {
    const doc = fixtureDocument();
    expect(doc.pageOrder).toEqual(["page_1"]);
    expect(seededRng(1).next()).toBe(seededRng(1).next());
  });
});
