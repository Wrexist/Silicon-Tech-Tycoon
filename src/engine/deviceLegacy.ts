// Device legacy lines (Track A: narrative & voice). The museum treated every device as an equal
// trophy; this gives each one a one-line legacy story keyed on how it actually did (verdict), what
// it was, and when it shipped, so the gallery reads as a career, not a spreadsheet. PURE. No em dashes.
import { eraName } from "./eras.ts";
import { CATEGORIES } from "./catalogs.ts";
import type { CategoryId } from "./types.ts";

/** A short authored legacy line for a shipped device, from its verdict + era + category. */
export function deviceLegacy(input: { verdict?: string; era: number; category: CategoryId }): string {
  const cat = (CATEGORIES[input.category]?.displayName ?? "device").toLowerCase();
  const era = eraName(input.era);
  switch (input.verdict) {
    case "hit":
      return `A breakout ${cat} that defined your run in the ${era}.`;
    case "solid":
      return `A solid ${cat} that paid the bills through the ${era}.`;
    case "flop":
      return `An ambitious ${cat} that missed its moment in the ${era}. Every empire has one.`;
    case "steady":
      return `A steady ${cat} from the ${era}; it held its own without making noise.`;
    default:
      return `A ${cat} shipped in the ${era}.`;
  }
}
