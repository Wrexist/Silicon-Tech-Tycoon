// Company Roadmap — a PURE, read-only view model of the game's long-horizon progression, assembled
// from the existing content catalogs (eras, categories, research). It exists so a player can SEE what
// they are grinding toward — future eras, categories, capstones, IPO, the Autonomy Era — instead of
// meeting each unlock unannounced. Zero engine state, zero RNG, zero determinism surface: it only
// reshapes static catalog data into plain strings for the UI. Nothing here feeds the sim.
import { BALANCE } from "./balance.ts";
import { CATEGORY_LIST } from "./catalogs.ts";
import { RESEARCH_PROJECTS } from "./research.ts";
import { eraContext, eraName } from "./eras.ts";
import { toDollars, type Money } from "./money.ts";

/** One era's row in the roadmap spine. All fields are display-ready plain strings. */
export interface EraRoadmapEntry {
  era: number;
  name: string;
  /** The authored one-line "what the world looks like now" tagline. */
  tagline: string;
  /** Plain-language entry gate, or null for era 1 (the starting point). */
  gate: string | null;
  /** Device-category display names that first become available AT this era. */
  newCategories: string[];
  /** Notable era-capstone research introduced at this era (names only — no spoilered effects). */
  notableResearch: string[];
  /** Major systems/divisions that open at this era. */
  majorSystems: string[];
}

/** Compact money shorthand for gate thresholds ($500K / $8M / $80M). */
function money(m: Money): string {
  const d = toDollars(m);
  if (d >= 1e9) return `$${(d / 1e9).toFixed(d % 1e9 === 0 ? 0 : 1)}B`;
  if (d >= 1e6) return `$${Math.round(d / 1e6)}M`;
  if (d >= 1e3) return `$${Math.round(d / 1e3)}K`;
  return `$${d}`;
}

// Major systems/divisions per era — these are the headline mechanics each era opens, named (not
// spoiled). Authored here because they're cross-cutting systems, not single catalog rows.
const MAJOR_SYSTEMS: Record<number, string[]> = {
  3: ["Platform / OS division"],
  4: ["AI research projects", "IPO — take the company public"],
  5: ["Frontier Tech lanes & bands"],
};

/** Plain-language description of what it takes to ENTER `era` (read from the real balance thresholds). */
export function eraEntryGate(era: number): string | null {
  if (era <= 1) return null; // the garage is where you begin
  if (era === BALANCE.autonomyEra.era) {
    // The AI→Autonomy step is the one era gated on going public + Frontier Tech, never rep/rev.
    return `Go public, then advance Frontier Tech to tier ${BALANCE.autonomyEra.tierToAdvance}`;
  }
  // Advancing FROM era-1 into `era` reads the previous era's rep/rev bars.
  const def = BALANCE.eras.find((e) => e.era === era - 1);
  if (!def || !Number.isFinite(def.repToAdvance)) return null;
  const rep = `Reputation ${def.repToAdvance}`;
  const rev = `${money(def.revToAdvance as Money)} revenue`;
  // Era 1→2 is either/or (an early milestone); every later step needs both.
  return era === 2 ? `${rep} or ${rev}` : `${rep} and ${rev}`;
}

/** The full era spine as display rows, one per era in BALANCE.eras. Pure. */
export function eraRoadmap(): EraRoadmapEntry[] {
  return BALANCE.eras.map((e) => ({
    era: e.era,
    name: eraName(e.era),
    tagline: eraContext(e.era).tagline,
    gate: eraEntryGate(e.era),
    newCategories: CATEGORY_LIST.filter((c) => c.unlockEra === e.era).map((c) => c.displayName),
    notableResearch: RESEARCH_PROJECTS.filter((p) => p.capstone && p.era === e.era).map((p) => p.name),
    majorSystems: MAJOR_SYSTEMS[e.era] ?? [],
  }));
}
