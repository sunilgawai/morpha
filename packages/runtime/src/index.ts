/**
 * @morpha/runtime — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/runtime/Engine-Lifecycle.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 1)
 */

import { PACKAGE_NAME as depCommands } from "@morpha/commands";
import { PACKAGE_NAME as depDomain } from "@morpha/domain";
import { PACKAGE_NAME as depEvents } from "@morpha/events";
import { PACKAGE_NAME as depState } from "@morpha/state";

export const PACKAGE_NAME: "@morpha/runtime" = "@morpha/runtime";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [
  depDomain,
  depEvents,
  depState,
  depCommands,
];
