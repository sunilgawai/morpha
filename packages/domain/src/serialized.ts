/**
 * The persisted projection of the domain model.
 *
 * Domain-Model.md §3 (amended 1.1.0): "The interfaces here describe the *live
 * in-memory* shape; the persisted shape is these interfaces minus the derived
 * caches." Serialization.md §4 owns the rule.
 *
 * What these types actually buy: a derived cache cannot be *declared* on a
 * persisted value and cannot be *read* off one. What they do not buy:
 * TypeScript does not excess-property-check spreads, so `{ ...livePage }`
 * still carries `widgetOrder` at runtime. Stripping at the persistence
 * boundary is Serialization.md §4's job and needs a runtime guarantee there
 * (Testing-Strategy.md §5 row P12), not a type.
 */

import type { PresentationDocument } from "./document.js";
import type { PageId } from "./ids.js";
import type { Page } from "./page.js";

/** `Page` without its runtime-only derived cache. */
export type SerializedPage = Omit<Page, "widgetOrder">;

/** `PresentationDocument` without any runtime-only derived cache. */
export type SerializedPresentationDocument = Omit<PresentationDocument, "pageOrder" | "pages"> & {
  pages: Record<PageId, SerializedPage>;
};
