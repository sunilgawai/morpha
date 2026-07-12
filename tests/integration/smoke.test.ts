import { PACKAGE_NAME as domain } from "@morpha/domain";
import { DECLARED_DEPENDENCIES as runtimeDeps } from "@morpha/runtime";
import { expect, it } from "vitest";

it("the runtime declares the domain as a dependency (Package-Structure.md §3)", () => {
  expect(runtimeDeps).toContain(domain);
});
