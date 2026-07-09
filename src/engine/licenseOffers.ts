// Inbound OS licensing contracts — the "cool contracts" layer. Companies APPROACH the player wanting
// to ship the player's OS on their devices, proposing a deal: a big upfront SIGNING BONUS plus a
// recurring royalty, over a term. Some suitors demand EXCLUSIVITY (a premium bonus + richer royalty,
// but they get a bigger competitive uplift and lock the category to one partner). Deterministic —
// a derived hash of (seed, week), never the main sim RNG — and fully gated behind platformUnlocked,
// so the pinned economy is untouched. PURE.
import { BALANCE } from "./balance.ts";
import { dollars, scale, toDollars, type Money } from "./money.ts";
import { rivalLicenseFee } from "./platform.ts";
import type { CategoryId } from "./types.ts";

/** A rival who could license your OS: their brand strength + the category they'd ship it in. */
export interface LicenseSuitor {
  id: string;
  name: string;
  reputation: number;
  category: CategoryId;
}

/** How hard a suitor bargains — derived from stable, observable traits (reputation + exclusivity), so
 *  the hint the player sees is HONEST about the negotiation odds without revealing the exact roll. */
export type SuitorTemper = "eager" | "measured" | "hardball";

/** A suitor's negotiating temper: proud (high-reputation) or exclusivity-demanding brands play
 *  hardball; humbler ones are eager to close. Pure, stable — the same for a given offer every time. */
export function suitorTemper(reputation: number, exclusive: boolean): SuitorTemper {
  if (exclusive || reputation >= 60) return "hardball";
  if (reputation >= 40) return "measured";
  return "eager";
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
  /** How hard the suitor bargains — sets the negotiation odds + the hint shown to the player.
   *  Optional/backfilled so old saves (and hand-built test offers) stay valid. */
  temper?: SuitorTemper;
  /** True once the player has pushed this deal — negotiation is a ONE-shot gamble per offer. */
  negotiated?: boolean;
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
    temper: suitorTemper(pick.reputation, exclusive),
    negotiated: false,
  };
}

// ---------- Negotiation: push a deal for a bigger signing bonus (a one-shot gamble) ----------
/** The result of pushing an offer. `improved` sweetens the upfront bonus; `firm` leaves the original
 *  terms on the table; `walked` means the suitor took offence and pulled the deal entirely. */
export type NegotiationOutcome = "improved" | "firm" | "walked";

export interface NegotiationResult {
  outcome: NegotiationOutcome;
  /** The resulting signing bonus (raised on `improved`, unchanged on `firm`/`walked`). */
  signingBonus: Money;
  /** How much the bonus grew on an `improved` result (0 otherwise) — for the reveal copy. */
  bonusDelta: Money;
}

/** The temper an offer bargains at (falls back for old/hand-built offers with no stored temper). */
export function offerTemper(offer: LicenseOffer): SuitorTemper {
  return offer.temper ?? (offer.exclusive ? "hardball" : "measured");
}

/** Resolve a negotiation on an offer — DETERMINISTIC (derived hash, salt 163; never the sim RNG), so a
 *  given offer always negotiates to the same result (no save-scum re-rolls). The suitor's temper sets
 *  the walk / improve / hold-firm bands; a win lifts the signing bonus by `bonusMult` (capped). Pure. */
export function negotiateLicenseOffer(seed: number, offer: LicenseOffer): NegotiationResult {
  const n = BALANCE.platform.contract.negotiate;
  const bands = n[offerTemper(offer)];
  const roll = hash01(seed, offer.week, 163);
  if (roll < bands.walk) {
    return { outcome: "walked", signingBonus: offer.signingBonus, bonusDelta: dollars(0) };
  }
  if (roll < bands.walk + bands.improve) {
    const cap = BALANCE.platform.contract.signBonusCap;
    const raised = dollars(Math.min(cap, Math.round(toDollars(scale(offer.signingBonus, n.bonusMult)))));
    return { outcome: "improved", signingBonus: raised, bonusDelta: dollars(Math.max(0, toDollars(raised) - toDollars(offer.signingBonus))) };
  }
  return { outcome: "firm", signingBonus: offer.signingBonus, bonusDelta: dollars(0) };
}
