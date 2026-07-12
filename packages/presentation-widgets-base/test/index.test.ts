import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("presentation-widgets-base (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("presentation-widgets-base");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual(["presentation-domain", "presentation-widget-api"]);
  });
});
