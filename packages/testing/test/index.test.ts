import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("@morpha/testing (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@morpha/testing");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual([
      "@morpha/domain",
      "@morpha/runtime",
      "@morpha/commands",
    ]);
  });
});
