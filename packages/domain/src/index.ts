/**
 * @morpha/domain — the Presentation Domain Model (Ring 0).
 *
 * Owning architecture document: docs/architecture/domain/Domain-Model.md
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring 0)
 *
 * This package imports nothing. Shapes are transcribed from the handbook
 * verbatim; changing one requires an ADR, not an edit here.
 */

export type { Asset, AssetSource } from "./asset.js";
export type {
  Clock,
  IdGenerator,
  MeasureConstraints,
  Rng,
  TextLayout,
  TextMeasurer,
  TextRun,
} from "./capabilities.js";
export type { ColorValue, ThemeColorToken } from "./color.js";
export type {
  CanvasConfig,
  DocumentMetadata,
  PresentationDocument,
} from "./document.js";
export type { Transform } from "./geometry.js";
export type {
  AssetId,
  EntityId,
  LayoutId,
  PageId,
  ThemeId,
  WidgetId,
  WidgetTypeId,
} from "./ids.js";
export type { Ordered } from "./ordering.js";
export {
  compareOrdered,
  compareOrderKeys,
  generateKeyBetween,
  generateNKeysBetween,
} from "./ordering.js";
export type { Background, Page } from "./page.js";
export type {
  SerializedPage,
  SerializedPresentationDocument,
} from "./serialized.js";
export type { Theme } from "./theme.js";
export type { LayoutConstraints, WidgetInstance } from "./widget.js";

export const PACKAGE_NAME: "@morpha/domain" = "@morpha/domain";

/** The dependency edges declared by Package-Structure.md, made real so that
 * dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [];
