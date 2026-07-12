/**
 * @presentation/export-pptx — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/persistence/Serialization.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 2)
 */
import { PACKAGE_NAME as depDomain } from "@presentation/domain";
import { PACKAGE_NAME as depPluginApi } from "@presentation/plugin-api";
import { PACKAGE_NAME as depSerialization } from "@presentation/serialization";

export const PACKAGE_NAME: "@presentation/export-pptx" = "@presentation/export-pptx";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [depDomain, depSerialization, depPluginApi];
