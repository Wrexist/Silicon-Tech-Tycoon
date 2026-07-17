// Ascension / Heat — the opt-in New Game+ difficulty ladder. Pure helpers only; the modifiers are
// applied at a handful of gated seams (launchBars raises the verdict bars, newGame cuts the legacy
// head-start, Founder Legend rewards the best level cleared). Everything keys off a single level
// integer, and level 0 is the neutral identity — so a normal run and the pinned 160-week sim (which
// never ascends) are byte-identical.
import { BALANCE } from "./balance.ts";

/** Clamp a requested level into the valid 0..maxLevel range. */
export function clampAscension(level: number | undefined): number {
  const n = Math.floor(level ?? 0);
  return n < 0 ? 0 : n > BALANCE.ascension.maxLevel ? BALANCE.ascension.maxLevel : n;
}

/** Multiplier on the verdict bars (hit / solid / flop) — higher Heat, higher bars, so a mediocre
 *  device flops where it used to steady and a hit demands more. Level 0 → 1 (unchanged). */
export function ascensionBarFactor(level: number | undefined): number {
  return 1 + clampAscension(level) * BALANCE.ascension.barsPerLevel;
}

/** Multiplier on the legacy head-start (cash / rep / fans / RP granted at founding). Higher Heat,
 *  smaller head-start, floored at 0 (a max-Heat run inherits almost nothing). Level 0 → 1 (unchanged). */
export function ascensionHeadStartFactor(level: number | undefined): number {
  return Math.max(0, 1 - clampAscension(level) * BALANCE.ascension.headStartCutPerLevel);
}

/** Founder Legend score contributed by the best Heat level ever CLEARED (reached IPO/prestige at). */
export function ascensionLegendBonus(bestLevel: number | undefined): number {
  return clampAscension(bestLevel) * BALANCE.ascension.legendPerLevel;
}

// Escalating rung names — flavour for the picker + badges. Beyond the table it's just "Heat N".
const HEAT_NAMES = [
  "No Heat",       // 0
  "Warm",          // 1
  "Heated",        // 2
  "Scorching",     // 3
  "Blazing",       // 4
  "Molten",        // 5
  "Infernal",      // 6
  "Volcanic",      // 7
  "Solar",         // 8
  "Supernova",     // 9
  "Singularity",   // 10
] as const;

/** A short label for a Heat level, e.g. "Heat 3 · Scorching" (or "No Heat" at 0). */
export function ascensionName(level: number | undefined): string {
  const n = clampAscension(level);
  if (n === 0) return HEAT_NAMES[0];
  const name = HEAT_NAMES[n] ?? `Heat ${n}`;
  return `Heat ${n} · ${name}`;
}
