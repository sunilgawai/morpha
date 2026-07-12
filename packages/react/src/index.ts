/**
 * @presentation/react — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/packages/Package-Structure.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 3)
 */

import { PACKAGE_NAME as depInteraction } from "@presentation/interaction";
import { PACKAGE_NAME as depRendering } from "@presentation/rendering";
import { PACKAGE_NAME as depRuntime } from "@presentation/runtime";

export const PACKAGE_NAME: "@presentation/react" = "@presentation/react";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [depRuntime, depRendering, depInteraction];
