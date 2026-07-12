/**
 * @presentation/plugin-api — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/plugins/Plugin-System.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 2)
 */

import { PACKAGE_NAME as depCommands } from "@presentation/commands";
import { PACKAGE_NAME as depDomain } from "@presentation/domain";
import { PACKAGE_NAME as depInteraction } from "@presentation/interaction";
import { PACKAGE_NAME as depRendering } from "@presentation/rendering";
import { PACKAGE_NAME as depWidgetApi } from "@presentation/widget-api";

export const PACKAGE_NAME: "@presentation/plugin-api" = "@presentation/plugin-api";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [
  depDomain,
  depCommands,
  depWidgetApi,
  depRendering,
  depInteraction,
];
