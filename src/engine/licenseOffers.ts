// Inbound OS licensing contracts — the "cool contracts" layer. Companies APPROACH the player wanting
// to ship the player's OS on their devices, proposing a deal: a big upfront SIGNING BONUS plus a
// recurring royalty, over a term. Some suitors demand EXCLUSIVITY (a premium bonus + richer royalty,
// but they get a bigger competitive uplift and lock the category to one partner). Deterministic —
// a derived hash of (seed, week), never the main sim RNG — and fully gated behind platformUnlocked,
// so the pinned economy is untouched. PURE.
import { BALANCE } from "./balance.ts";
import { dollars, scale, type Money } from "./money.ts";
import { rivalLicenseFee } from "./platform.ts";
import type { CategoryId } from "./types.ts";

/** A rival who could license your OS: their brand strength + the category they'd ship it in. */
export interface LicenseSuitor {
  id: string;
  name: string;
  reputation: number;
  category: CategoryId;
}

export interface LicenseOffer {
  id: string;
  rivalId: string;
  rivalName: string;
  /** The device category the suitor wants to ship your OS in. */
  category: CategoryId;
  /** Exclusive deals pay a premium but lock the category and strengthen the partner more. */
  exclusive: boolean;
  /** Upfront cash paid to YOU on signing. */
  signingBonus: Money;
  /** Recurring royalty the partner pays (matches what weeklyLicenseFees will bill). */
  royaltyPerWeek: Money;
  /** Flavour term length in weeks (the contract's headline duration). */
  termWeeks: number;
  /** The offer lapses after this week. */
  expiresWeek: number;
  week: number;
}

/** Tiny deterministic hash → [0,1), same recipe as side orders / reviews — never draws the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Should a fresh inbound offer appear this week? Only once the OS is credible (tier ≥ minOsTier),
 *  then roughly one offer per cooldown window (deterministic cadence). */
export function licenseOfferDue(seed: number, week: number, osTierNum: number): boolean {
  const c = BALANCE.platform.contract;
  if (osTierNum < c.minOsTier) return false;
  return hash01(seed, week, 91) < 1 / c.offerCooldownWeeks;
}

/** Upfront signing bonus for a deal — scales with the suitor's reputation × your OS tier, capped;
 *  an exclusive deal pays the premium multiplier. */
export function licenseSigningBonus(rivalReputation: number, osTierNum: number, exclusive: boolean): Money {
  const c = BALANCE.platform.contract;
  const rep = Number.isFinite(rivalReputation) ? Math.max(0, rivalReputation) : 0;
  const tier = Number.isFinite(osTierNum) ? Math.max(1, Math.floor(osTierNum)) : 1;
  let d = c.signBonusBase + rep * tier * c.signBonusPerRepTier;
  if (exclusive) d *= c.exclusiveBonusMult;
  return dollars(Math.min(c.signBonusCap, Math.round(d)));
}

/** The (deterministic) inbound offer for this week from the eligible suitor pool, or null if nobody
 *  qualifies. Bigger, prouder brands (higher reputation) are the ones who demand exclusivity. */
export function generateLicenseOffer(
  seed: number,
  week: number,
  osTierNum: number,
  suitors: readonly LicenseSuitor[],
): LicenseOffer | null {
  if (suitors.length === 0) return null;
  const c = BALANCE.platform.contract;
  const pick = suitors[Math.floor(hash01(seed, week, 101) * suitors.length) % suitors.length];
  const exclusive = pick.reputation >= 55 && hash01(seed, week, 113) < 0.4;
  const royaltyBase = rivalLicenseFee(pick.reputation, osTierNum);
  const royalty = exclusive ? scale(royaltyBase, c.exclusiveRoyaltyMult) : royaltyBase;
  const termWeeks = 26 + Math.floor(hash01(seed, week, 127) * 79); // ~26..104 weeks (½–2 years)
  return {
    id: `lo-${week}`,
    rivalId: pick.id,
    rivalName: pick.name,
    category: pick.category,
    exclusive,
    signingBonus: licenseSigningBonus(pick.reputation, osTierNum, exclusive),
    royaltyPerWeek: royalty,
    termWeeks,
    expiresWeek: week + c.lifeWeeks,
    week,
  };
}
