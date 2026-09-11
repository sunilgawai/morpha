/**
 * Entity identifiers — Domain-Model.md §10.
 *
 * IDs are opaque strings produced by an injected `IdGenerator` (Principle 8;
 * ADR-0005 §3). No core code path generates one inline.
 */

/** Domain-Model.md §10: opaque; format is an implementation detail. */
export type EntityId = string;

export type PageId = EntityId;
export type WidgetId = EntityId;
export type AssetId = EntityId;
export type ThemeId = EntityId;

/**
 * Domain-Model.md §4 (`Page.layoutRef`). Registered in §10's ID list by the
 * 1.2.0 follow-up patch — the field predated the list.
 */
export type LayoutId = EntityId;

/** Domain-Model.md §10: a plugin-registered key such as `"text"` — NOT a UUID. */
export type WidgetTypeId = string;
