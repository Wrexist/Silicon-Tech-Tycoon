// Side Orders — client commissions that run on the PLAYER'S factory line. A deterministic offer
// stream (hash of seed + week, never the main sim RNG) proposes contract work: build N units of
// someone else's hardware on your floor for a fee, inside a deadline. Accepting occupies the line
// (your own builds take +1 week while it runs) and pays on completion — the classic tycoon
// contract-work loop, and a reason the floor keeps mattering between your own launches.
// PURE + sim-safe: offers are display until accepted, and the pinned auto-player never accepts.
import { dollars, type Money } from "./money.ts";
import type { MachineKind } from "./factoryFloor.ts";

export interface SideOrderOffer {
  id: string;
  clientName: string;
  blurb: string;
  units: number;
  /** Paid per unit ON COMPLETION — no upfront cost; the line itself is the investment. */
  feePerUnit: Money;
  /** Fixed production time once accepted. */
  weeksNeeded: number;
  /** Machine kinds the floor must have (besides a wired Intake→Packer line). */
  requiredKinds: MachineKind[];
  /** The offer disappears after this week — the game's act-now moment. */
  expiresWeek: number;
  week: number;
}

export interface ActiveSideOrder extends Omit<SideOrderOffer, "expiresWeek"> {
  startedWeek: number;
}

/** Total payout of an offer/active order. */
export function sideOrderPayout(o: { units: number; feePerUnit: Money }): Money {
  return Math.round(o.units * o.feePerUnit) as Money;
}

/** The fee for walking out on an accepted order (fraction of the payout). */
export const SIDE_ORDER_CANCEL_PCT = 0.25;
/** Your own builds take this many extra weeks while the line runs a client's order. */
export const SIDE_ORDER_BUILD_DELAY = 1;
/** Offers start appearing once the company is real. */
export const SIDE_ORDER_MIN_WEEK = 16;
/** How long an offer stays on the table. */
export const SIDE_ORDER_LIFE_WEEKS = 2;

// Flavor clients — deliberately NOT the rivals (they'd never outsource to you) but the wider
// hardware economy: labs, fleets, retailers who need boards and enclosures, not brands.
const CLIENTS: { name: string; blurb: string; kinds: MachineKind[] }[] = [
  { name: "Zenith Labs", blurb: "sensor boards for a research fleet", kinds: ["press", "qa"] },
  { name: "Northwind Logistics", blurb: "rugged scanner enclosures", kinds: ["mill", "qa"] },
  { name: "Helio Medical", blurb: "bedside monitor panels", kinds: ["screen", "qa"] },
  { name: "Apex Retail", blurb: "kiosk display assemblies", kinds: ["screen", "arm"] },
  { name: "Bluebird Air", blurb: "seat-back entertainment units", kinds: ["screen", "press"] },
  { name: "Vantage Fitness", blurb: "trainer console boards", kinds: ["press", "arm"] },
];

/** Tiny deterministic hash → [0,1). Same recipe as the other derived channels (reviews, poach):
 *  keyed off (seed, week, salt) so the MAIN sim RNG stream is never drawn. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Should a fresh offer appear this week? ~1 week in 7 once the company qualifies. */
export function sideOrderDue(seed: number, week: number): boolean {
  return week >= SIDE_ORDER_MIN_WEEK && hash01(seed, week, 11) < 0.14;
}

/** The (deterministic) offer for this week. Era scales the ask and the fee — late-game clients
 *  bring bigger orders to a bigger shop. */
export function generateSideOrder(seed: number, week: number, era: number): SideOrderOffer {
  const client = CLIENTS[Math.floor(hash01(seed, week, 23) * CLIENTS.length) % CLIENTS.length];
  const eraScale = 1 + (Math.max(1, Math.min(4, era)) - 1) * 0.7;
  const units = Math.round((500 + hash01(seed, week, 37) * 900) * eraScale / 50) * 50;
  const feePerUnit = dollars(Math.round(9 + hash01(seed, week, 53) * 9)) as Money;
  const weeksNeeded = 3 + Math.floor(hash01(seed, week, 71) * 3); // 3..5
  return {
    id: `so-${week}`,
    clientName: client.name,
    blurb: client.blurb,
    units,
    feePerUnit,
    weeksNeeded,
    requiredKinds: client.kinds,
    expiresWeek: week + SIDE_ORDER_LIFE_WEEKS,
    week,
  };
}

/** Which of the order's required machine kinds are missing from the floor (empty = eligible). */
export function sideOrderMissingKinds(present: Iterable<MachineKind>, offer: SideOrderOffer): MachineKind[] {
  const have = new Set(present);
  return offer.requiredKinds.filter((k) => !have.has(k));
}
