import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("@morpha/rendering (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@morpha/rendering");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual([
      "@morpha/domain",
      "@morpha/state",
      "@morpha/widget-api",
    ]);
  });
});
