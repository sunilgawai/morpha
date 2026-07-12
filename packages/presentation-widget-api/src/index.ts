/**
 * presentation-widget-api — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/widgets/Widget-System.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 2)
 */
import { PACKAGE_NAME as depDomain } from "presentation-domain";

export const PACKAGE_NAME: "presentation-widget-api" = "presentation-widget-api";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [depDomain];
