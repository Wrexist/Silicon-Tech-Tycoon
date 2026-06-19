// Platform / OS division (DLC #1, Phase A+B) — PURE. Surfaces the OS economy that already runs
// invisibly in the engine (the `software` component line + `ecosystem` stat + the recurring
// ecosystem-service revenue) as a first-class division. This module owns the pure computations;
// the state layer reframes the existing weeklyEcosystemRevenue and adds the version-release moment.
// Everything is gated behind `platformUnlocked` (the DLC entitlement) at the state/UI layer.
import { BALANCE } from "./balance.ts";
import { tierDef } from "./catalogs.ts";
import { dollars, type Money } from "./money.ts";
import type { LaunchedProduct } from "./types.ts";

/** Devices in the field running your OS — the sum of units sold across every launched product
 *  (software is a global line, so every product you ship runs your OS). */
export function installedBase(launched: readonly LaunchedProduct[]): number {
  let n = 0;
  for (const lp of launched) n += lp.unitsSold;
  return n;
}

export interface OsTierInfo {
  tier: number;
  name: string;
}

/** The current OS tier (name + number) from the software research level. */
export function osTier(softwareResearched: number | undefined): OsTierInfo {
  const tier = Math.max(1, Math.floor(softwareResearched ?? 1));
  return { tier, name: tierDef("software", tier)?.name ?? "BasicOS" };
}

/** Can the player release a new OS version? Only when their software research has advanced past
 *  the currently-released version (releasing == catching the public release up to your tech). */
export function canReleaseVersion(osVersion: number, softwareResearched: number | undefined): boolean {
  return osTier(softwareResearched).tier > Math.max(1, Math.floor(osVersion || 1));
}

export interface ReleaseReward {
  reputation: number;
  fans: number;
}

/** The one-time, BOUNDED reward for releasing a new OS version — a "launch day" for software that
 *  lifts the whole installed base's goodwill. Deliberately a one-shot rep/fan moment (NOT a
 *  recurring rate change) so it can't trivialize the carefully-tuned recurring economy; the fan
 *  bonus scales gently with installed base but is hard-capped ("no free faucet", spec §5). */
export function osReleaseReward(base: number): ReleaseReward {
  const p = BALANCE.platform;
  const fans = Math.min(p.releaseFanCap, p.releaseFanBaseBonus + Math.floor(Math.max(0, base) / 1000) * p.releaseFanPerKInstalled);
  return { reputation: p.releaseRepBonus, fans };
}

// ---------- Phase C: licensing your OS to rivals ----------
/** Weekly fee a rival pays to license your OS, scaling with their reputation and your OS tier.
 *  Bounded by a hard cap (no runaway income). The trade-off — a licensee gets a competitiveness
 *  uplift (licenseeStrengthUplift) — is applied where launch competition is evaluated. */
export function rivalLicenseFee(rivalReputation: number, osTierNum: number): Money {
  const p = BALANCE.platform;
  const rep = Number.isFinite(rivalReputation) ? Math.max(0, rivalReputation) : 0;
  const tier = Number.isFinite(osTierNum) ? Math.max(1, Math.floor(osTierNum)) : 1;
  const d = p.licenseFeeBase + rep * tier * p.licenseFeePerRepTier;
  return dollars(Math.min(p.licenseFeeCap, Math.round(d)));
}

/** Strength points added to a licensee rival in categories where they compete (the "teeth"). */
export function licenseeStrengthUplift(): number {
  return BALANCE.platform.licenseStrengthUplift;
}
