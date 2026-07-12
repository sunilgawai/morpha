import { PACKAGE_NAME as domain } from "presentation-domain";
import { DECLARED_DEPENDENCIES as runtimeDeps } from "presentation-runtime";
import { expect, it } from "vitest";

it("the runtime declares the domain as a dependency (Package-Structure.md §3)", () => {
  expect(runtimeDeps).toContain(domain);
});
