/**
 * presentation-rendering — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/rendering/Rendering-Architecture.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 2)
 */
import { PACKAGE_NAME as depDomain } from "presentation-domain";
import { PACKAGE_NAME as depState } from "presentation-state";
import { PACKAGE_NAME as depWidgetApi } from "presentation-widget-api";

export const PACKAGE_NAME: "presentation-rendering" = "presentation-rendering";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [depDomain, depState, depWidgetApi];
