// Challenge Seasons — a visible, cosmetic-only reward track layered on the date-seeded daily/weekly
// challenges. Completing challenges within a calendar-month "season" climbs reward rungs that unlock
// lasting flair: a device colourway, an HQ floor + wall finish, and a profile badge at the top rung.
//
// Determinism: this lives ENTIRELY outside the pure sim — a localStorage profile store (like
// founderLegend / museum / achievementsProfile), read only by the UI and written from a useGame
// side-effect when a challenge locks its score. Zero GameState fields, zero engine reads, so the
// reproducibility pin is untouched. Season identity + reward sets are a PURE function of the challenge
// DATE string (never wall-clock randomness), so every offline player sees the identical track.
import { mirrorToNative } from "./nativeStore.ts";
import { makeRng } from "../engine/rng.ts";
import { hashSeed } from "../engine/challenges.ts";
import { SEASON_SWATCH_NAMES } from "../render/deviceStyle.ts";
import { FLOOR_FINISHES, WALL_STYLES, SEASON_FLOOR_IDS, SEASON_WALL_IDS } from "../engine/roomStyle.ts";

const KEY = "silicon.seasons.v1";

/** Completions required to reach each rung. Tuned for the daily (≤~30/month) + weekly (≤~4/month)
 *  cadence: 3 = a casual dabbler, 20 = a dedicated month. Each rung grants one cosmetic. */
export const SEASON_RUNGS: readonly number[] = [3, 7, 12, 20];

export type SeasonRewardType = "colorway" | "floor" | "wall" | "badge";

export interface SeasonReward {
  /** Completions needed to earn it. */
  rung: number;
  type: SeasonRewardType;
  /** Stable unlock id (also what the Design Lab / HQ gates check). */
  cosmeticId: string;
  /** Display name. */
  name: string;
}

/** Fixed pool of top-rung profile badges (id + title). Authored once — a season DRAWS from this pool
 *  by hashing its id, so there's no per-season content treadmill. */
export const SEASON_BADGES: readonly { id: string; name: string }[] = [
  { id: "regular", name: "Season Regular" },
  { id: "devotee", name: "Challenge Devotee" },
  { id: "ace", name: "Seasonal Ace" },
  { id: "marathoner", name: "Season Marathoner" },
  { id: "streak", name: "Streak Keeper" },
  { id: "champion", name: "Season Champion" },
];

// ---------- Pure season derivation ------------------------------------------------------------

/** The season id for a challenge date key ("YYYY-MM-DD" → "YYYY-MM"). A season is a calendar month,
 *  derived from the challenge DATE (never the wall clock), so it's stable + offline. Returns "" for a
 *  malformed key. */
export function seasonIdOf(dateKey: string): string {
  if (typeof dateKey !== "string") return "";
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(dateKey.trim());
  return m ? `${m[1]}-${m[2]}` : "";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Human label for a season id: "2026-07" → "July 2026". Falls back to the raw id if malformed. */
export function seasonLabel(seasonId: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(seasonId ?? "");
  if (!m) return seasonId || "Season";
  const mi = Number(m[2]) - 1;
  return `${MONTHS[mi] ?? m[2]} ${m[1]}`;
}

/** The season the current wall-clock date falls in (UTC month) — for the "this month" UI header. */
export function currentSeasonId(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mo}`;
}

function floorName(id: string): string {
  return FLOOR_FINISHES.find((f) => f.id === id)?.name ?? id;
}
function wallName(id: string): string {
  return WALL_STYLES.find((w) => w.id === id)?.name ?? id;
}

/** The reward set for a season — DETERMINISTIC from the season id (same id → same rewards everywhere).
 *  Draws one colourway, one floor, one wall and one badge from the fixed pools and pins them to the
 *  four rungs (color → floor → wall → badge at the top). */
export function seasonRewards(seasonId: string): SeasonReward[] {
  const rng = makeRng(hashSeed(`season:${seasonId}`));
  const pick = <T>(pool: readonly T[]): T => pool[rng.int(pool.length)];
  const swatch = pick(SEASON_SWATCH_NAMES);
  const floorId = pick(SEASON_FLOOR_IDS);
  const wallId = pick(SEASON_WALL_IDS);
  const badge = pick(SEASON_BADGES);
  return [
    { rung: SEASON_RUNGS[0], type: "colorway", cosmeticId: `col:${swatch}`, name: `${swatch} colourway` },
    { rung: SEASON_RUNGS[1], type: "floor", cosmeticId: `flr:${floorId}`, name: `${floorName(floorId)} floor` },
    { rung: SEASON_RUNGS[2], type: "wall", cosmeticId: `wal:${wallId}`, name: `${wallName(wallId)} walls` },
    { rung: SEASON_RUNGS[3], type: "badge", cosmeticId: `bdg:${badge.id}`, name: badge.name },
  ];
}

// ---------- The profile store -----------------------------------------------------------------

/** Per-season set of completed challenge keys ("kind:dateKey"), stored so recording is IDEMPOTENT —
 *  re-running the same daily can never double-count. All-time unlocked cosmetics are DERIVED from these
 *  counts against each season's reward set (self-healing; nothing to keep in sync). */
export interface SeasonsStore {
  completions: Record<string, string[]>;
}

function sanitize(raw: unknown): SeasonsStore {
  if (!raw || typeof raw !== "object") return { completions: {} };
  const comp = (raw as { completions?: unknown }).completions;
  if (!comp || typeof comp !== "object" || Array.isArray(comp)) return { completions: {} };
  const out: Record<string, string[]> = {};
  for (const [sid, list] of Object.entries(comp as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(sid) || !Array.isArray(list)) continue;
    // De-dupe + keep only well-formed "kind:dateKey" strings whose date sits IN this season.
    const seen = new Set<string>();
    for (const k of list) {
      if (typeof k !== "string" || seen.has(k)) continue;
      const sep = k.indexOf(":");
      if (sep < 0) continue;
      if (seasonIdOf(k.slice(sep + 1)) !== sid) continue;
      seen.add(k);
    }
    if (seen.size > 0) out[sid] = [...seen];
  }
  return { completions: out };
}

export function getSeasons(): SeasonsStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { completions: {} };
    return sanitize(JSON.parse(raw));
  } catch {
    return { completions: {} };
  }
}

function write(store: SeasonsStore): void {
  const serialized = JSON.stringify(store);
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
}

/** The completion count for a season (0 if none). */
export function seasonCount(seasonId: string, store: SeasonsStore = getSeasons()): number {
  return store.completions[seasonId]?.length ?? 0;
}

export interface SeasonCompletionResult {
  seasonId: string;
  prevCount: number;
  count: number;
  /** Rewards whose rung was crossed by THIS completion (empty on a duplicate/idempotent re-record). */
  crossed: SeasonReward[];
}

/** Record a completed challenge into its season track. Idempotent — keyed by "kind:dateKey", so
 *  re-completing the same daily never counts twice. Returns which reward rungs (if any) this crossed,
 *  so the caller can celebrate them once. */
export function recordSeasonCompletion(challengeKey: string): SeasonCompletionResult {
  const noop = (seasonId: string, count: number): SeasonCompletionResult => ({ seasonId, prevCount: count, count, crossed: [] });
  if (typeof challengeKey !== "string") return noop("", 0);
  const sep = challengeKey.indexOf(":");
  if (sep < 0) return noop("", 0);
  const seasonId = seasonIdOf(challengeKey.slice(sep + 1));
  if (!seasonId) return noop("", 0);

  const store = getSeasons();
  const list = store.completions[seasonId] ?? [];
  if (list.includes(challengeKey)) return noop(seasonId, list.length); // already counted — idempotent

  const prevCount = list.length;
  const count = prevCount + 1;
  store.completions = { ...store.completions, [seasonId]: [...list, challengeKey] };
  write(store);
  const crossed = seasonRewards(seasonId).filter((r) => prevCount < r.rung && count >= r.rung);
  return { seasonId, prevCount, count, crossed };
}

/** Bulk-restore from a backup — UNION of completed keys per season (never a downgrade). */
export function mergeSeasons(incoming: unknown): void {
  const inc = sanitize(incoming);
  if (Object.keys(inc.completions).length === 0) return;
  const cur = getSeasons();
  const merged: Record<string, string[]> = { ...cur.completions };
  for (const [sid, list] of Object.entries(inc.completions)) {
    const set = new Set([...(merged[sid] ?? []), ...list]);
    merged[sid] = [...set];
  }
  write({ completions: merged });
}

// ---------- Derived: all-time unlocked cosmetics ----------------------------------------------

/** Every cosmetic id unlocked across every season (count ≥ its rung). Pure over the store, so it's
 *  always consistent with the completion record. */
export function unlockedCosmetics(store: SeasonsStore = getSeasons()): Set<string> {
  const out = new Set<string>();
  for (const [sid, list] of Object.entries(store.completions)) {
    const count = list.length;
    for (const r of seasonRewards(sid)) if (count >= r.rung) out.add(r.cosmeticId);
  }
  return out;
}

/** Unlocked device colourway NAMES (aluminium swatches) — the Design Lab gate. */
export function unlockedColorwayNames(store: SeasonsStore = getSeasons()): Set<string> {
  const out = new Set<string>();
  for (const id of unlockedCosmetics(store)) if (id.startsWith("col:")) out.add(id.slice(4));
  return out;
}

/** Unlocked HQ floor ids — the decorate-panel gate. */
export function unlockedFloorIds(store: SeasonsStore = getSeasons()): Set<string> {
  const out = new Set<string>();
  for (const id of unlockedCosmetics(store)) if (id.startsWith("flr:")) out.add(id.slice(4));
  return out;
}

/** Unlocked HQ wall ids — the decorate-panel gate. */
export function unlockedWallIds(store: SeasonsStore = getSeasons()): Set<string> {
  const out = new Set<string>();
  for (const id of unlockedCosmetics(store)) if (id.startsWith("wal:")) out.add(id.slice(4));
  return out;
}

export interface EarnedBadge { id: string; name: string; seasonId: string }

/** Every badge earned (top rung reached), newest season first — for the profile/Seasons UI. */
export function earnedBadges(store: SeasonsStore = getSeasons()): EarnedBadge[] {
  const out: EarnedBadge[] = [];
  for (const [sid, list] of Object.entries(store.completions)) {
    const count = list.length;
    for (const r of seasonRewards(sid)) {
      if (r.type === "badge" && count >= r.rung) out.push({ id: r.cosmeticId.slice(4), name: r.name, seasonId: sid });
    }
  }
  out.sort((a, b) => (a.seasonId < b.seasonId ? 1 : a.seasonId > b.seasonId ? -1 : 0));
  return out;
}
