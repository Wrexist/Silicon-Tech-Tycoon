// Regional events — once you've expanded past Home, each foreign market occasionally throws a
// respond-or-ignore MOMENT: a boom to ride, a tariff to answer, or a rival surge to defend against.
// Responding costs cash and lifts your STANDING (regional loyalty → that region's reach); ignoring is
// free but usually costs you standing. Makes global expansion a living commitment, not a one-time buy.
// PURE + deterministic.
//
// Sim-safe by construction: the cadence is a DERIVED hash of (seed, week) — never the sim RNG — and
// the outcome is player-CLAIMED. The pinned solo sim never expands past Home, so it never fires or
// resolves one → byte-identical.
import { BALANCE } from "./balance.ts";
import { scale, type Money } from "./money.ts";
import type { RegionId } from "./types.ts";

export type RegionalEventKind = "boom" | "tariff" | "rivalSurge";

/** Presentational copy per event kind — shared by the feed line and the interrupt card (icons are
 *  resolved in the UI). `respond` / `ignore` name the two choices; `outcomeRespond` / `outcomeIgnore`
 *  are the short reveal lines. Pure data, no economy. */
export const REGIONAL_EVENT_COPY: Record<RegionalEventKind, {
  eyebrow: string; title: string; feed: string; blurb: string;
  respond: string; ignore: string; icon: string; tone: "positive" | "negative";
}> = {
  boom: {
    eyebrow: "Regional boom", title: "The market is booming",
    feed: "demand there is surging.", tone: "positive",
    blurb: "Buyers here are piling in. Fund a local push to ride the wave and win real loyalty, or let it pass and take the trickle.",
    respond: "Fund the push", ignore: "Let it ride", icon: "TrendingUp",
  },
  tariff: {
    eyebrow: "New tariff", title: "A tariff hits",
    feed: "a new import tariff threatens your standing.", tone: "negative",
    blurb: "New duties make you look expensive here. Absorb the cost to keep buyers on-side, or pass it on and lose standing.",
    respond: "Absorb the cost", ignore: "Pass it on", icon: "Landmark",
  },
  rivalSurge: {
    eyebrow: "Rival surge", title: "A rival is surging",
    feed: "a rival is winning buyers there.", tone: "negative",
    blurb: "A competitor is gaining ground in this market. Answer with a counter-campaign to defend your standing, or cede the region for now.",
    respond: "Counter-campaign", ignore: "Cede ground", icon: "Swords",
  },
};

export interface RegionalEvent {
  week: number;
  regionId: RegionId; // never "home"
  kind: RegionalEventKind;
  cost: Money;             // cash to respond
  loyaltyRespond: number;  // loyalty delta if you respond (and pay)
  loyaltyIgnore: number;   // loyalty delta if you let it pass
  /** Item 5.7 — the actual rival surging here (a real competitor name, salt 269), on rivalSurge only. */
  rivalName?: string;
  /** Item 5.7 — the region's buying taste ("design-led", …) for region-specific flavor. */
  tasteLabel?: string;
}

/** Tiny deterministic hash → [0,1), same recipe as eureka / staff moments — never the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const KINDS: readonly RegionalEventKind[] = ["boom", "tariff", "rivalSurge"];

/** Should a regional event fire this week? Roughly one per cadence window (deterministic). Callers
 *  gate on era / having expanded / cooldown before consulting this. */
export function regionalEventDue(seed: number, week: number): boolean {
  return hash01(seed, week, 211) < 1 / BALANCE.market.regions.events.cadenceWeeks;
}

/** Build the event: pick one of the eligible (non-home, unlocked) regions + a kind, scale the response
 *  cost by era. `regions` must be the player's unlocked NON-HOME markets (non-empty). Item 5.7 — pass
 *  `rivalNames` (live competitor names) so a rivalSurge names the ACTUAL surging rival (salt 269), and
 *  `tasteLabel` so the copy reflects the region's buying taste. Both optional → older callers/tests
 *  unaffected. Pure + deterministic. */
export function generateRegionalEvent(
  seed: number, week: number, regions: readonly RegionId[], era: number,
  rivalNames?: readonly string[], tasteLabel?: string,
): RegionalEvent {
  const ev = BALANCE.market.regions.events;
  const regionId = regions[Math.floor(hash01(seed, week, 223) * regions.length) % regions.length];
  const kind = KINDS[Math.floor(hash01(seed, week, 227) * KINDS.length) % KINDS.length];
  const cost = scale(ev.costBase, 1 + Math.max(0, Math.floor(era) - 1) * ev.costPerEra);
  const loyalty =
    kind === "boom" ? { r: ev.boomLoyaltyRespond, i: ev.boomLoyaltyIgnore }
    : kind === "tariff" ? { r: ev.tariffLoyaltyRespond, i: ev.tariffLoyaltyIgnore }
    : { r: ev.surgeLoyaltyRespond, i: ev.surgeLoyaltyIgnore };
  // Name the real surging rival on a rivalSurge (derived hash, salt 269 — never the sim rng).
  const rivalName = kind === "rivalSurge" && rivalNames && rivalNames.length > 0
    ? rivalNames[Math.floor(hash01(seed, week, 269) * rivalNames.length) % rivalNames.length]
    : undefined;
  return { week, regionId, kind, cost, loyaltyRespond: loyalty.r, loyaltyIgnore: loyalty.i, rivalName, tasteLabel };
}
