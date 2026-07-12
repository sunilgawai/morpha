/**
 * @morpha/devtools — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/packages/Package-Structure.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 3)
 */

import { PACKAGE_NAME as depCommands } from "@morpha/commands";
import { PACKAGE_NAME as depEvents } from "@morpha/events";
import { PACKAGE_NAME as depPluginApi } from "@morpha/plugin-api";
import { PACKAGE_NAME as depRuntime } from "@morpha/runtime";

export const PACKAGE_NAME: "@morpha/devtools" = "@morpha/devtools";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [
  depRuntime,
  depEvents,
  depCommands,
  depPluginApi,
];
