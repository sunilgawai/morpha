/** Themes — Domain-Model.md §9. */

import type { ThemeColorToken } from "./color.js";
import type { ThemeId } from "./ids.js";

/**
 * Domain-Model.md §9 fixes the *shape* only, so that Theme-System.md
 * (pending) is not designing against a moving target. Cascading and
 * inheritance rules are that document's, not this one's.
 */
export interface Theme {
  id: ThemeId;
  name: string;
  /** Token name -> resolved color. */
  colorTokens: Record<ThemeColorToken, string>;
  typography: {
    /** Token -> font family string. */
    fontFamilies: Record<string, string>;
    /** E.g. `"heading-1"` -> 32. */
    scale: Record<string, number>;
  };
  /** Base spacing unit in engine units; widgets reference multiples. */
  spacingUnit: number;
}
