/**
 * presentation-testing — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/packages/Package-Structure.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 3)
 */

import { PACKAGE_NAME as depCommands } from "presentation-commands";
import { PACKAGE_NAME as depDomain } from "presentation-domain";
import { PACKAGE_NAME as depRuntime } from "presentation-runtime";

export const PACKAGE_NAME: "presentation-testing" = "presentation-testing";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [depDomain, depRuntime, depCommands];
