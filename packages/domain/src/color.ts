/** Color primitives — Domain-Model.md §7. */

/**
 * Domain-Model.md §7: theme-defined and deliberately not a closed enum.
 * Theme-System.md owns the token vocabulary.
 */
export type ThemeColorToken = string;

/**
 * Domain-Model.md §7. Widget plugins choose per field whether a style
 * property is theme-aware (`theme`) or intentionally theme-independent
 * (`static`, e.g. a brand logo's fixed color).
 */
export type ColorValue =
  | { type: "static"; value: string }
  | { type: "theme"; token: ThemeColorToken };
