import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("@morpha/widgets-base (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@morpha/widgets-base");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual(["@morpha/domain", "@morpha/widget-api"]);
  });
});
