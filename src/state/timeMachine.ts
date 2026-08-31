// The Time Machine — rolling snapshots of your company that you can rewind to.
//
// ── WHY THIS IS THE PRO FEATURE THAT JUSTIFIES A SUBSCRIPTION ───────────────────────────────────
// The loudest objection to subscriptions in games is "I'll lose interest in a few weeks, so why
// would I pay every month?" Unlocked content doesn't answer that — it's a one-time purchase wearing
// a subscription's clothes. An ongoing SERVICE does: for as long as you subscribe, your company is
// protected. One catastrophic launch, one over-hired quarter, one mistimed factory buy no longer
// ends a twenty-hour run. That is a reason to keep paying that stays true in month six.
//
// ── AND WHY IT ISN'T PAY-TO-WIN ─────────────────────────────────────────────────────────────────
// Snapshots are taken ONLY in the freeform campaign — never in a scenario, never in a daily or
// weekly challenge. Those are the modes with star ratings and scored, seeded runs where rewinding
// would be cheating, and where a free player and a Pro player must be measured on the same terms.
// A test pins that. In the freeform campaign there is nothing to cheat: it's your own company, and
// the only person a rewind affects is you.
//
// PURE-ish (localStorage only, injectable clock) so every branch is unit-testable.
import type { GameState } from "./gameState.ts";
import { parseSaveJson } from "./persistence.ts";
import { isPro } from "./pro.ts";

const TM_KEY = "silicon.timeMachine.v1";

/** How many snapshots are kept. Five covers roughly the last ~20 in-game weeks — far enough back to
 *  undo a bad decision, near enough that a restore never erases an evening of play. */
export const MAX_SNAPSHOTS = 5;

/** Snapshot cadence in simulated weeks. Four is a fiscal quarter in this game's calendar, which is
 *  also the rhythm the player already thinks in (the HUD reads "Y1 Q3"). */
export const SNAPSHOT_EVERY_WEEKS = 4;

/** What the UI shows for a snapshot. Deliberately does NOT include the state itself — listing the
 *  Time Machine must not deserialize five full companies. */
export interface SnapshotMeta {
  /** Stable id: the week it was taken plus the wall-clock stamp, so two runs can't collide. */
  id: string;
  /** Simulated week the snapshot captured. */
  week: number;
  /** Wall-clock ms when it was written — "3 days ago". */
  savedAt: number;
  companyName: string;
  /** Products shipped at that point, for a one-glance "where was I". */
  products: number;
  /** Cash in integer cents at that point (the `Money` representation). */
  cash: number;
}

interface StoredSnapshot extends SnapshotMeta {
  /** The serialized GameState. Restored through the loader's own migrate path. */
  json: string;
}

/* ─────────────────────────────  READ  ───────────────────────────── */

function readAll(): StoredSnapshot[] {
  try {
    const raw = localStorage.getItem(TM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop anything malformed rather than letting one bad row break the whole list.
    return parsed.filter(
      (s): s is StoredSnapshot =>
        s && typeof s === "object" && typeof s.id === "string" && typeof s.json === "string" && Number.isFinite(s.week),
    );
  } catch {
    return [];
  }
}

/** Snapshots, newest first. Cheap — no state is deserialized. */
export function listSnapshots(): SnapshotMeta[] {
  return readAll()
    .slice()
    .sort((a, b) => b.savedAt - a.savedAt)
    .map(({ json: _json, ...meta }) => meta);
}

/* ─────────────────────────────  CAPTURE  ───────────────────────────── */

/** True when `week` is a snapshot week. Pure — exported for tests. */
export function isSnapshotWeek(week: number): boolean {
  return Number.isFinite(week) && week > 0 && week % SNAPSHOT_EVERY_WEEKS === 0;
}

/** True when this run is one the Time Machine is allowed to touch: the freeform campaign only.
 *  Scenarios and challenges are scored, so rewinding them would be cheating. Pure. */
export function isEligibleRun(state: Pick<GameState, "activeScenario" | "activeChallenge" | "bankrupt">): boolean {
  if (state.activeScenario) return false;
  if (state.activeChallenge) return false;
  // A bankrupt run has already ended — the bankruptcy overlay owns the recovery path, and a
  // snapshot taken at the moment of death would just be a worse version of "start a new company".
  if (state.bankrupt) return false;
  return true;
}

/**
 * Take a snapshot if one is due. Called from the weekly tick as a pure side-effect — it never
 * changes game state, so the simulation stays byte-identical whether or not the player has Pro.
 *
 * Returns true if a snapshot was written.
 */
export function captureIfDue(state: GameState, now: number = Date.now(), pro: boolean = isPro()): boolean {
  if (!pro) return false;
  if (!isSnapshotWeek(state.week)) return false;
  if (!isEligibleRun(state)) return false;

  const all = readAll();
  // Already have this week (a re-render, a reload landing on the same week) — nothing to do.
  if (all.some((s) => s.week === state.week)) return false;

  let json: string;
  try {
    json = JSON.stringify(state);
  } catch {
    return false; // un-serializable state — never a reason to disturb the run
  }

  const snapshot: StoredSnapshot = {
    id: `w${state.week}-${now}`,
    week: state.week,
    savedAt: now,
    companyName: state.companyName || "Untitled",
    products: state.launched.length,
    cash: state.cash,
    json,
  };

  // Newest first, capped. Oldest falls off the end.
  //
  // The snapshot just taken is pinned at the head by CONSTRUCTION rather than by its `savedAt`:
  // sorting the whole list on a wall-clock stamp lets a device clock that moved BACKWARD (travel,
  // a manual change, a bad NTP sync) rank this one last of six and slice it straight off — the
  // player's Time Machine would then quietly stop recording until the clock caught back up to the
  // stale future stamps. Ordering the REST by recency keeps the list reading newest-first exactly
  // as before on a sane clock.
  const next = [
    snapshot,
    ...all.filter((s) => s.week !== state.week).sort((a, b) => b.savedAt - a.savedAt),
  ].slice(0, MAX_SNAPSHOTS);

  return writeAll(next);
}

/**
 * Persist the list, shedding the oldest snapshots if storage is full.
 *
 * A full quota must never cost the player their actual save. The autosave shares this storage, so
 * a Time Machine that greedily fills localStorage would break the very thing it exists to protect —
 * hence: on failure, drop the oldest and retry, and if even one snapshot won't fit, clear the
 * feature's storage entirely and give up quietly.
 */
function writeAll(list: StoredSnapshot[]): boolean {
  let attempt = list;
  while (attempt.length > 0) {
    try {
      localStorage.setItem(TM_KEY, JSON.stringify(attempt));
      return true;
    } catch {
      attempt = attempt.slice(0, attempt.length - 1); // shed the oldest and try again
    }
  }
  try {
    localStorage.removeItem(TM_KEY);
  } catch {
    /* storage is unusable — the game continues without snapshots */
  }
  return false;
}

/* ─────────────────────────────  RESTORE  ───────────────────────────── */

/**
 * Rehydrate a snapshot. Runs through the loader's own migrate/validation, so a snapshot written by
 * an older build can never restore a shape that crashes this one — it simply returns null and the
 * UI says so. Returns null for an unknown id, a corrupt payload, or when Pro has lapsed.
 */
export function restoreSnapshot(id: string, pro: boolean = isPro()): GameState | null {
  if (!pro) return null;
  const hit = readAll().find((s) => s.id === id);
  if (!hit) return null;
  return parseSaveJson(hit.json);
}

/** Wipe every snapshot. Called when a run ends deliberately (new company, prestige, import) so the
 *  Time Machine can never offer to rewind into a company the player has left behind. */
export function clearSnapshots(): void {
  try {
    localStorage.removeItem(TM_KEY);
  } catch {
    /* ignore */
  }
}

/** Human "how long ago" for the snapshot list. Kept here so the UI has no date logic of its own. */
export function agoLabel(savedAt: number, now: number = Date.now()): string {
  const ms = now - savedAt;
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
