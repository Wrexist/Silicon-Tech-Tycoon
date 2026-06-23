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

// ---------- OS feature modules: the customizable capabilities of your platform ----------
// Each module is a research investment (RP) gated behind an OS version. Installing it is permanent
// (it's built into the OS). Together they make the OS a real lever: `ecoBonus` lifts the ecosystem
// stat of every device you launch (a strong OS → better devices), and `servicesMult` raises the
// recurring services income from your whole installed base. IP-safe, fictional capabilities only.
export interface OsFeature {
  id: string;
  name: string;
  blurb: string;
  /** Lucide icon key — a plain string so the engine stays DOM-free; the UI maps it to a glyph. */
  icon: string;
  /** OS major version required before this module can be installed. */
  minVersion: number;
  /** Research points to build the module. */
  rpCost: number;
  /** Ecosystem-stat points every device you launch gains while this module ships. */
  ecoBonus: number;
  /** Added to the recurring-services revenue multiplier. */
  servicesMult: number;
}

export const OS_FEATURES: readonly OsFeature[] = [
  { id: "appMarket",  name: "App Marketplace",         icon: "Store",       minVersion: 1, rpCost: 25,  ecoBonus: 4, servicesMult: 0.22,
    blurb: "A first-party app store. Developers ship to your platform and you take a cut of every sale." },
  { id: "cloudSync",  name: "Cloud Sync",              icon: "Cloud",       minVersion: 1, rpCost: 30,  ecoBonus: 2, servicesMult: 0.14,
    blurb: "Photos, files and settings follow the user across every device they own." },
  { id: "assistant",  name: "On-Device Assistant",     icon: "Sparkles",    minVersion: 2, rpCost: 48,  ecoBonus: 3, servicesMult: 0.10,
    blurb: "A private voice + text assistant that makes the whole system feel smart." },
  { id: "privacy",    name: "Privacy Suite",           icon: "ShieldCheck", minVersion: 2, rpCost: 52,  ecoBonus: 3, servicesMult: 0.06,
    blurb: "On-device encryption and tracking controls. Buyers trust the platform more." },
  { id: "wallet",     name: "Wallet & Pay",            icon: "Wallet",      minVersion: 2, rpCost: 55,  ecoBonus: 3, servicesMult: 0.16,
    blurb: "Tap-to-pay and a built-in wallet — take a small cut of every transaction on your platform." },
  { id: "health",     name: "Health Hub",              icon: "HeartPulse",  minVersion: 3, rpCost: 70,  ecoBonus: 3, servicesMult: 0.12,
    blurb: "Activity, sleep and wellbeing tracking that pulls wearables into your ecosystem." },
  { id: "media",      name: "Media Studio",            icon: "Music",       minVersion: 3, rpCost: 80,  ecoBonus: 3, servicesMult: 0.14,
    blurb: "Music, film and TV subscriptions streamed to every device in your ecosystem." },
  { id: "continuity", name: "Cross-Device Continuity", icon: "Layers",      minVersion: 4, rpCost: 110, ecoBonus: 4, servicesMult: 0.18,
    blurb: "Hand off any task between your phone, tablet and laptop seamlessly — true lock-in." },
];

export function osFeatureById(id: string): OsFeature | undefined {
  return OS_FEATURES.find((f) => f.id === id);
}

/** Ecosystem-stat points the installed OS modules add to every device you launch (capped). */
export function osEcosystemBonus(featureIds: readonly string[]): number {
  let sum = 0;
  for (const id of featureIds) sum += osFeatureById(id)?.ecoBonus ?? 0;
  return Math.min(BALANCE.platform.features.ecoBonusCap, Math.max(0, sum));
}

// ---------- OS module synergies: pairs that reinforce each other ----------
// Building two complementary modules unlocks a synergy — an extra services bonus on top of each
// module's own. This rewards PLANNING the OS (build these two together), not just stacking modules.
// Bonuses are bounded and still subject to servicesMultCap. IP-safe, fictional capabilities only.
export interface OsSynergy {
  id: string;
  name: string;
  blurb: string;
  /** Both module ids must be installed for the synergy to activate. */
  requires: readonly [string, string];
  /** Extra recurring-services multiplier while active. */
  servicesMult: number;
}

export const OS_SYNERGIES: readonly OsSynergy[] = [
  { id: "commerce", name: "One-Tap Commerce", requires: ["appMarket", "wallet"], servicesMult: 0.10,
    blurb: "Buy from the store and pay in a single tap — conversions soar." },
  { id: "handoff", name: "Seamless Handoff", requires: ["cloudSync", "continuity"], servicesMult: 0.10,
    blurb: "Your files and your tasks follow you across every device, instantly." },
  { id: "wellbeing", name: "Proactive Wellbeing", requires: ["assistant", "health"], servicesMult: 0.08,
    blurb: "The assistant turns your health data into gentle daily nudges." },
];

/** Synergies currently active (both required modules installed). Pure. */
export function activeOsSynergies(featureIds: readonly string[]): OsSynergy[] {
  return OS_SYNERGIES.filter((s) => s.requires.every((r) => featureIds.includes(r)));
}

export interface OsSynergyRow extends OsSynergy { active: boolean; }

/** Every synergy with its active/locked state, for the UI. */
export function osSynergyRows(featureIds: readonly string[]): OsSynergyRow[] {
  return OS_SYNERGIES.map((s) => ({ ...s, active: s.requires.every((r) => featureIds.includes(r)) }));
}

/** Recurring-services revenue multiplier from the OS version + installed modules + active synergies
 *  (>=1, capped). */
export function osServicesMultiplier(osVersion: number, featureIds: readonly string[]): number {
  const f = BALANCE.platform.features;
  const version = Math.max(1, Math.floor(osVersion || 1));
  let mult = 1 + (version - 1) * f.versionServicesStep;
  for (const id of featureIds) mult += osFeatureById(id)?.servicesMult ?? 0;
  for (const s of activeOsSynergies(featureIds)) mult += s.servicesMult;
  return Math.min(f.servicesMultCap, Math.max(1, mult));
}

export type OsFeatureStatus = "installed" | "available" | "locked" | "unaffordable";

export interface OsFeatureRow extends OsFeature {
  status: OsFeatureStatus;
}

/** Per-module install/locked/affordable status for the UI (entitlement is enforced at the state layer). */
export function osFeatureRows(
  featureIds: readonly string[],
  osVersion: number,
  researchPoints: number,
): OsFeatureRow[] {
  const version = Math.max(1, Math.floor(osVersion || 1));
  const owned = new Set(featureIds);
  return OS_FEATURES.map((feat) => {
    let status: OsFeatureStatus;
    if (owned.has(feat.id)) status = "installed";
    else if (version < feat.minVersion) status = "locked";
    else if (researchPoints < feat.rpCost) status = "unaffordable";
    else status = "available";
    return { ...feat, status };
  });
}

/** Whether a specific module can be installed right now (version reached, RP affordable, not owned). */
export function canInstallOsFeature(
  featureIds: readonly string[],
  osVersion: number,
  researchPoints: number,
  id: string,
): boolean {
  const feat = osFeatureById(id);
  if (!feat || featureIds.includes(id)) return false;
  if (Math.max(1, Math.floor(osVersion || 1)) < feat.minVersion) return false;
  return researchPoints >= feat.rpCost;
}
