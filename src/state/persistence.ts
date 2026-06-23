// localStorage persistence with schema versioning + migration. The save is the
// player's company — never wipe it on an unknown-but-recoverable shape.
import { makeRng } from "../engine/rng.ts";
import { BALANCE } from "../engine/balance.ts";
import { canPlace, defaultLayout, deskItems, GRID } from "../engine/furniture.ts";
import { makeIdentity, makeSkills } from "../engine/staff.ts";
import { defaultCameraDesign, FINISH_ORDER, type FinishId, type Product, type StaffRole } from "../engine/types.ts";
import { SAVE_VERSION, industryRank, type GameState } from "./gameState.ts";
import { deriveFacts, evaluateAchievements } from "../engine/achievements.ts";
import { showToast } from "../design/toast.tsx";
import { mirrorToNative } from "./nativeStore.ts";

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const KEY = "silicon.save.v1";
const BACKUP_KEY = `${KEY}.bak`;

/** Outcome of attempting to read the save. */
export type LoadResult =
  | { status: "absent" } // no save key at all → safe to start fresh + let autosave overwrite
  | { status: "unreadable" } // a save exists but can't be migrated → preserved as a backup
  | { status: "ok"; state: GameState };

let quotaWarned = false;

/**
 * F3 — quota-safe save. On a QuotaExceededError, retry with a trimmed copy (drop the heavy
 * cashHistory + cap launched/feed). If even that fails, surface a one-time non-fatal signal so
 * the player knows progress may not persist — vs. silent data loss on iOS/WKWebView. Non-quota
 * errors (private mode, storage disabled) stay silent; the in-memory game continues.
 */
export function save(state: GameState): void {
  const write = (s: GameState) => {
    const json = JSON.stringify(s);
    localStorage.setItem(KEY, json);
    // Durable copy on native (WKWebView localStorage is OS-evictable). Fire-and-forget.
    mirrorToNative(KEY, json);
  };
  try {
    write(state);
  } catch (e) {
    if (!isQuotaError(e)) return; // storage unavailable — fail silent, in-memory game continues
    try {
      write(trimState(state));
    } catch {
      if (!quotaWarned) {
        quotaWarned = true;
        try {
          // showToast is a pure UI util — no dependency back on the state layer, so no cycle.
          showToast("Storage full — progress may not be saved.", { tone: "negative" });
        } catch {
          /* toast host not mounted (e.g. tests) */
        }
        console.warn("[silicon] Save failed: storage quota exceeded. Progress may not persist.");
      }
    }
  }
}

/** Trimmed save: drop the heaviest, least-critical fields so a near-full quota still fits. */
function trimState(state: GameState): GameState {
  return {
    ...state,
    cashHistory: state.cashHistory.slice(-1),
    launched: state.launched.slice(0, 12),
    feed: state.feed.slice(-20),
  };
}

function isQuotaError(e: unknown): boolean {
  // Match by name/code without relying on a global DOMException (absent in some runtimes).
  if (!e || typeof e !== "object") return false;
  const err = e as { name?: unknown; code?: unknown };
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  );
}

/**
 * F2 — read the save, distinguishing ABSENT (no key — safe to start a new game and let the next
 * autosave overwrite) from UNREADABLE (present but un-migratable: a too-new version or missing
 * required fields). On UNREADABLE we copy the raw bytes to a backup key BEFORE the caller starts
 * fresh, so a returning player's data is preserved and recoverable rather than silently destroyed
 * by the next autosave.
 */
export function loadResult(): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage unavailable: report absent so the game still runs, but never claim a readable save.
    return { status: "absent" };
  }
  if (raw === null) return { status: "absent" };

  let migrated: GameState | null = null;
  try {
    migrated = migrate(JSON.parse(raw) as GameState);
  } catch {
    migrated = null;
  }
  if (migrated) return { status: "ok", state: migrated };

  // Present but unreadable: preserve the raw bytes before the caller starts a new game.
  try {
    localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    /* best-effort backup */
  }
  return { status: "unreadable" };
}

/**
 * Backwards-compatible wrapper: returns the migrated state, else null. Returns null for BOTH
 * absent and unreadable — callers that must avoid clobbering an unreadable save use loadResult().
 */
export function load(): GameState | null {
  const r = loadResult();
  return r.status === "ok" ? r.state : null;
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  // The mirror must follow a deliberate reset, or the old company resurrects on next boot.
  mirrorToNative(KEY, null);
}

/* ---------- Save export / import (offline backup; no backend, no accounts) ---------- */

// A short marker prepended to the base64 so a pasted string can be sanity-checked before decode,
// and so the format is self-describing if the player saves it to a file.
const EXPORT_PREFIX = "SILICON1:";

/** UTF-8 safe base64 encode (handles non-ASCII company names without btoa throwing). */
function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** UTF-8 safe base64 decode. */
function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Serialize a GameState to a portable, self-describing backup string (prefix + base64 JSON).
 * Pure — operates on the passed live state, so it works even before the first autosave.
 */
export function exportSaveString(state: GameState, profile?: Record<string, unknown>): string {
  // With a profile bundle, wrap as { save, profile } so a backup also carries cross-run progression
  // (legacy, scenario stars, challenge bests, museum). Without one, emit a bare state (unchanged).
  const payload = profile ? { save: state, profile } : state;
  return EXPORT_PREFIX + toBase64(JSON.stringify(payload));
}

/** Extract the profile bundle from a backup string, or null if it's a bare (pre-profile) export. */
export function importProfileFromString(str: string): Record<string, unknown> | null {
  if (typeof str !== "string") return null;
  let payload = str.trim();
  if (payload.startsWith(EXPORT_PREFIX)) payload = payload.slice(EXPORT_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(fromBase64(payload)) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && "save" in parsed && parsed.profile && typeof parsed.profile === "object") {
      return parsed.profile as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a backup string produced by exportSaveString. Tolerates a missing/extra prefix and
 * surrounding whitespace. Runs the bytes through the SAME migrate/validation the loader uses, so
 * an import can never inject a shape that crashes the game. Returns the migrated state, or null
 * on any failure (bad base64, bad JSON, un-migratable shape).
 */
export function importSaveString(str: string): GameState | null {
  if (typeof str !== "string") return null;
  let payload = str.trim();
  if (!payload) return null;
  if (payload.startsWith(EXPORT_PREFIX)) payload = payload.slice(EXPORT_PREFIX.length).trim();
  try {
    const json = fromBase64(payload);
    const parsed = JSON.parse(json) as GameState | { save: GameState };
    // A v2 backup wraps the state as { save, profile }; a bare export IS the state. Back-compat.
    const state = parsed && typeof parsed === "object" && "save" in parsed ? parsed.save : (parsed as GameState);
    return migrate(state);
  } catch {
    return null;
  }
}

function fixProduct(p: Product): Product {
  return { ...p, camera: p.camera ?? defaultCameraDesign(), notch: p.notch ?? "punch", tuning: p.tuning ?? "balanced" };
}

/** Forward-migrate older saves. Backfills fields added after the save was written so a
 *  returning player's company never crashes the new build. */
function migrate(state: GameState): GameState | null {
  if (typeof state.version !== "number") return null;
  if (state.version > SAVE_VERSION) return null; // newer than this build — don't risk it

  // v2 expansion: research points, projects, build pipeline, staff assignment/xp, device fields.
  // Deserialization boundary — `any` is appropriate here for shape-tolerant backfilling.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const s: any = state;
  // Sanity: core fields that have always existed — bail to a fresh game if they're missing/broken
  // (a truncated save), rather than crash on the first tick.
  if (s.trends == null || s.competitors == null || s.staff == null) return null;
  // Core numeric/array fields that, if missing on a truncated/old save, crash the first tick.
  if (!Number.isFinite(s.week)) s.week = 0;
  if (!Number.isFinite(s.cash)) s.cash = 0;
  if (!Number.isFinite(s.reputation)) s.reputation = 8;
  if (!Number.isFinite(s.fans)) s.fans = 250;
  if (!Number.isFinite(s.cumulativeRevenue)) s.cumulativeRevenue = 0;
  // Same unsigned formula as newGame's default — the old Date.now()*2**31 overflowed Number
  // precision before the modulo, collapsing most regenerated seeds toward the same few values.
  if (!Number.isFinite(s.seed)) s.seed = (Math.random() * 2 ** 31) >>> 0;
  if (!Number.isFinite(s.rngState)) s.rngState = s.seed;
  if (!Number.isFinite(s.facilityTier) || s.facilityTier < 1) s.facilityTier = 1;
  if (!Number.isFinite(s.lastActive)) s.lastActive = Date.now();
  if (!s.researched || typeof s.researched !== "object") s.researched = { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 };
  if (!Array.isArray(s.launched)) s.launched = [];
  if (!Array.isArray(s.cashHistory)) s.cashHistory = [{ week: s.week ?? 0, cash: 0 }];
  if (!Array.isArray(s.feed)) s.feed = [];
  if (s.productCounter == null) s.productCounter = 1;
  if (s.staffCounter == null) s.staffCounter = s.staff?.length ?? 1;
  if (s.sandboxUnlocked == null) s.sandboxUnlocked = false;
  if (s.onboarded == null) s.onboarded = true;
  // Returning players (pre-tutorial saves) shouldn't suddenly get the first-build coach.
  if (s.tutorialDone == null) s.tutorialDone = true;
  if (s.trendRetargetWeek == null) s.trendRetargetWeek = (s.week ?? 0) + 14;
  if (s.researchPoints == null || !Number.isFinite(s.researchPoints)) s.researchPoints = 0;
  if (s.era == null || s.era < 1) s.era = 1;
  if (!Array.isArray(s.completedProjects)) s.completedProjects = [];
  if (!Array.isArray(s.building)) s.building = [];
  if (!Array.isArray(s.ready)) s.ready = [];
  if (s.upgrades == null || typeof s.upgrades !== "object") s.upgrades = {};
  if (s.nextEventWeek == null) s.nextEventWeek = (s.week ?? 0) + 8;
  if (s.lastEvent === undefined) s.lastEvent = null;
  if (s.wentPublic == null) s.wentPublic = false;
  if (s.legacy == null) s.legacy = 0;
  // Equity / stock market (added later) — backfill so old saves can trade + keep ownership.
  if (s.listed == null) s.listed = false;
  if (!Number.isFinite(s.ownership)) s.ownership = 1;
  if (!s.holdings || typeof s.holdings !== "object") s.holdings = {};
  // Achievements (added later): default to an empty set. Already-earned milestones are then
  // backfilled SILENTLY at the end of migrate (after all fields are valid) so a returning player
  // isn't dumped a dozen toasts on first load — they're marked unlocked without a celebration.
  if (!Array.isArray(s.unlockedAchievements)) s.unlockedAchievements = [];
  if (s.pendingChoice === undefined) s.pendingChoice = null;
  if (!Array.isArray(s.resolvedChoices)) s.resolvedChoices = [];
  // Scenario mode (added later): old saves are freeform runs → no active scenario.
  if (typeof s.activeScenario !== "string") s.activeScenario = null;
  if (!Number.isFinite(s.scenarioRunStars) || s.scenarioRunStars < 0) s.scenarioRunStars = 0;
  // Challenge mode (added later): keep a well-formed activeChallenge or null; locked score numeric/null.
  {
    const ac = s.activeChallenge;
    s.activeChallenge =
      ac && typeof ac === "object" && typeof ac.dateKey === "string" && Number.isFinite(ac.scoreWeek)
        ? ac
        : null;
    if (!Number.isFinite(s.challengeScore)) s.challengeScore = null;
  }
  // Platform / OS division (DLC, added later): default locked + a v1 OS for old saves.
  if (typeof s.platformUnlocked !== "boolean") s.platformUnlocked = false;
  if (typeof s.osName !== "string") s.osName = "";
  if (!Number.isFinite(s.osVersion) || s.osVersion < 1) s.osVersion = 1;
  if (!Array.isArray(s.osLicensees)) s.osLicensees = [];
  // OS feature modules (added later): default none — a save loads with an un-customized OS, so
  // ecosystem bonus = 0 and services multiplier = 1 until the player builds modules.
  if (!Array.isArray(s.osFeatures)) s.osFeatures = [];
  // Rival releases (Epic B, added later): default empty — they repopulate as rivals launch.
  if (!Array.isArray(s.rivalReleases)) s.rivalReleases = [];
  // Rival series counters (added later): default empty; seed from existing releases so a mid-save
  // upgrade doesn't restart series numbers below what's already on screen.
  if (!s.rivalLineCounters || typeof s.rivalLineCounters !== "object") {
    const counters: Record<string, number> = {};
    if (Array.isArray(s.rivalReleases)) {
      for (const r of s.rivalReleases as { rivalId?: string; category?: string }[]) {
        const key = `${r?.rivalId}:${r?.category}`;
        counters[key] = (counters[key] ?? 0) + 1;
      }
    }
    s.rivalLineCounters = counters;
  }
  // Acquired rivals (Epic B3, added later): default none.
  if (!Array.isArray(s.acquiredRivals)) s.acquiredRivals = [];
  // Delegation toggles (Epic E, added later): default off.
  if (!s.automation || typeof s.automation !== "object") s.automation = { autoAssign: false, autoResearch: false };
  else s.automation = { autoAssign: !!s.automation.autoAssign, autoResearch: !!s.automation.autoResearch };
  // Garage desktops (added later): default to none. Clamp to the valid 0–max range.
  if (!Number.isFinite(s.desktops) || s.desktops < 0) s.desktops = 0;
  // Lens unlocks (added later): pre-gating saves could design 1–4 lenses freely, so grant at
  // least what the save already USES — nobody loses a capability they had.
  if (!Number.isFinite(s.lensLimit)) {
    const used = [
      ...(Array.isArray(s.building) ? s.building.map((b: any) => b?.product?.camera?.count) : []),
      ...(Array.isArray(s.ready) ? s.ready.map((p: any) => p?.camera?.count) : []),
      ...(Array.isArray(s.launched) ? s.launched.map((lp: any) => lp?.product?.camera?.count) : []),
    ].filter((n: unknown): n is number => Number.isFinite(n));
    s.lensLimit = Math.max(2, Math.min(4, used.length ? Math.max(...used) : 2));
  }
  // Finish unlocks (added later): grant at least the highest finish index the save already uses,
  // so a pre-gating titanium/gold design never becomes un-selectable. Default = free basics.
  if (!Number.isFinite(s.finishLimit)) {
    const idx = (f: unknown) => FINISH_ORDER.indexOf(f as FinishId);
    const used = [
      ...(Array.isArray(s.building) ? s.building.map((b: any) => idx(b?.product?.finish)) : []),
      ...(Array.isArray(s.ready) ? s.ready.map((p: any) => idx(p?.finish)) : []),
      ...(Array.isArray(s.launched) ? s.launched.map((lp: any) => idx(lp?.product?.finish)) : []),
    ].filter((n: number) => n >= 0);
    s.finishLimit = Math.max(BALANCE.design.freeFinishes - 1, used.length ? Math.max(...used) : 0);
  }
  if (Array.isArray(s.competitors)) {
    s.competitors = s.competitors.map((c: any) => ({
      ...c,
      blurb: typeof c.blurb === "string" ? c.blurb : "A rival in the market.",
      sharePrice: Number.isFinite(c.sharePrice) ? c.sharePrice : 5000,
      priceHistory: Array.isArray(c.priceHistory) && c.priceHistory.length ? c.priceHistory : [Number.isFinite(c.sharePrice) ? c.sharePrice / 100 : 50],
    }));
  }
  // Industry leaderboard (added later): seed the best-rank to the player's CURRENT rank so a
  // returning player isn't spammed with "overtook" celebrations for progress already behind them.
  if (!Number.isFinite(s.bestIndustryRank)) {
    try { s.bestIndustryRank = industryRank(s as GameState); }
    catch { s.bestIndustryRank = 7; }
  }
  if (typeof s.companyName !== "string" || !s.companyName) s.companyName = "Silicon";
  if (!Array.isArray(s.layout)) s.layout = defaultLayout();
  if (!s.roomStyle || typeof s.roomStyle !== "object" || typeof s.roomStyle.floor !== "number" || typeof s.roomStyle.wall !== "number") {
    s.roomStyle = { floor: s.roomStyle?.floor ?? 0, wall: s.roomStyle?.wall ?? 0 };
  }
  if (typeof s.furnitureCounter !== "number") {
    s.furnitureCounter = s.layout.reduce((m: number, it: { iid?: string }) => {
      const n = parseInt(String(it.iid ?? "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n + 1) : m;
    }, 20);
  }
  // v17: desks are seats — hiring is desk-gated and robots sit at PLACED desks. Saves from the
  // auto-workstation era may own fewer desks than employees: grant the missing desks at free
  // cells so nobody loses a hire they already paid for. If the room is genuinely full the
  // overflow staff roam (the 3D layer's existing fallback) — never block, never corrupt.
  if (Array.isArray(s.staff)) {
    let desks = deskItems(s.layout).length;
    let guard = 0;
    while (desks < s.staff.length && guard++ < 32) {
      let placed = false;
      outer: for (let r = 0; r < GRID.n; r++) {
        for (let c = 0; c < GRID.n; c++) {
          if (canPlace(s.layout, "desk", c, r, 0)) {
            s.layout = [...s.layout, { iid: `f${s.furnitureCounter++}`, type: "desk", c, r, rot: 0 }];
            desks++;
            placed = true;
            break outer;
          }
        }
      }
      if (!placed) break; // no free cell — overflow staff roam instead
    }
  }
  s.ready = s.ready.map((p: Product) => fixProduct(p));
  if (Array.isArray(s.staff)) {
    s.staff = s.staff.map((m: any) => {
      if (m.assignment == null) {
        m.assignment = m.role === "designer" ? "design" : m.role === "marketer" ? "marketing" : "rnd";
      }
      if (m.xp == null) m.xp = 0;
      // v2.1: identity (specialty/trait/mood/appearance) — backfill deterministically from id.
      if (m.specialty == null || m.appearance == null) {
        const id = makeIdentity(makeRng(hashId(m.id ?? "s0")), (m.role as StaffRole) ?? "engineer");
        if (m.specialty == null) m.specialty = id.specialty;
        if (m.trait == null) m.trait = id.trait;
        if (m.mood == null) m.mood = id.mood;
        if (m.appearance == null) m.appearance = id.appearance;
      }
      // v2.2: per-discipline 0..100 skills — backfill deterministically from id + headline skill.
      if (m.skills == null) {
        m.skills = makeSkills(makeRng(hashId((m.id ?? "s0") + "k")), (m.role as StaffRole) ?? "engineer", Math.max(1, Math.min(10, Math.round(m.skill ?? 3))));
      }
      if (m.moodLowWeeks == null) m.moodLowWeeks = 0;
      return m;
    });
  }
  // v2.2: recruitment system fields
  if (s.recruitment === undefined) s.recruitment = null;
  if (!Array.isArray(s.candidates)) s.candidates = [];
  if (s.candidateCounter == null) s.candidateCounter = 0;
  if (s.candidatesExpire == null) s.candidatesExpire = 0;
  // a search saved under the pre-tier shape gets the cheapest channel
  if (s.recruitment && s.recruitment.tier == null) s.recruitment.tier = "board";
  if (Array.isArray(s.launched)) {
    s.launched = s.launched.map((lp: any) => {
      if (lp.product) lp.product = fixProduct(lp.product);
      // Coerce the per-product fields the sales tick dereferences so a truncated/older save can't
      // crash on the first sales pass (advanceOneWeek reads lp.weeklyUnits.length and
      // lp.stats.ecosystem). Defaults are inert — an empty curve simply books no further sales.
      if (!Array.isArray(lp.weeklyUnits)) lp.weeklyUnits = [];
      if (!Number.isFinite(lp.weeksElapsed)) lp.weeksElapsed = 0;
      if (!Number.isFinite(lp.totalUnits)) lp.totalUnits = lp.weeklyUnits.reduce((a: number, b: number) => a + (Number.isFinite(b) ? b : 0), 0);
      if (!Number.isFinite(lp.unitsSold)) lp.unitsSold = 0;
      if (!Number.isFinite(lp.revenueToDate)) lp.revenueToDate = 0;
      if (!Number.isFinite(lp.unitCost)) lp.unitCost = 0;
      if (!lp.stats || typeof lp.stats !== "object") lp.stats = {};
      // Backfill the launch verdict for saves written before it was recorded. competitionFactor
      // wasn't stored, so approximate from the (stored) launchScore against the same thresholds —
      // a reasonable design-quality read for old history rather than crashing or showing blanks.
      if (lp.verdict == null && Number.isFinite(lp.launchScore)) {
        lp.verdict = lp.launchScore >= 76 ? "hit" : lp.launchScore <= 22 ? "flop" : "steady";
      }
      return lp;
    });
  }
  // Silent achievement backfill — now that every field is valid, mark milestones the player has
  // ALREADY earned as unlocked WITHOUT firing toasts. Only fill when empty (first migrate of an old
  // save); never overwrite a set the player has been accumulating. The live evaluator then finds
  // nothing new on the next tick, so a returning player is never spammed with a dozen celebrations.
  if (Array.isArray(s.unlockedAchievements) && s.unlockedAchievements.length === 0) {
    try {
      s.unlockedAchievements = evaluateAchievements(deriveFacts(state));
    } catch {
      s.unlockedAchievements = [];
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return state;
}
