/**
 * presentation-commands — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/runtime/Command-System.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 1)
 */
import { PACKAGE_NAME as depDomain } from "presentation-domain";
import { PACKAGE_NAME as depEvents } from "presentation-events";
import { PACKAGE_NAME as depState } from "presentation-state";

export const PACKAGE_NAME: "presentation-commands" = "presentation-commands";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [depDomain, depEvents, depState];
