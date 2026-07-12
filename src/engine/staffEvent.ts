// Staff life events (item 2.2) — a named teammate hits a personal turning point (burnout, an outside
// offer, a milestone, a growth itch) and the PLAYER answers with a small, human choice. Converts
// fire-and-forget morale into recurring micro-decisions with stakes, and makes losing someone sting.
// PURE + deterministic.
//
// Sim-safe by construction: the cadence is a DERIVED hash of (seed, week) — never the sim RNG (salt
// 233) — and the outcome is player-CHOSEN via an opt-in reducer. The founder is never a target and a
// solo/founder-only team never raises one, so the pinned sim stays byte-identical.
import { BALANCE } from "./balance.ts";
import { format, type Money } from "./money.ts";
import { moodBand } from "./staff.ts";
import type { Staff, StaffRole } from "./types.ts";

/** A concrete outcome the reducer applies. All fields optional; a do-nothing option is legal. */
export interface StaffEventEffect {
  /** Mood delta for THIS teammate (−100..100). */
  mood?: number;
  /** Mood delta for EVERYONE (a party / a public misstep). */
  teamMood?: number;
  /** +N skill levels for this teammate (a funded course). */
  skill?: number;
  /** Up-front cash cost (Money, integer cents). */
  cashCost?: Money;
  /** Extend this teammate's poach-immunity by N weeks (loyalty earned). */
  retainWeeks?: number;
}

export interface StaffEventOption {
  label: string;
  blurb: string;
  effect: StaffEventEffect;
}

export interface StaffLifeEvent {
  week: number;
  staffId: string;
  staffName: string;
  role: StaffRole;
  title: string;
  body: string;
  options: StaffEventOption[]; // 2–3 player choices
}

/** Tiny deterministic hash → [0,1), same recipe as staffMoment / eureka — never the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Eligible for a life event: a non-founder who's been around a little while. */
export function lifeEventEligible(s: Staff, week: number): boolean {
  const c = BALANCE.staff.lifeEvents;
  if (s.id === "s0") return false;
  return week - (s.hiredWeek ?? 0) >= c.minTenureWeeks;
}

/** Should a life event fire this week? ~one per cadence window (deterministic). */
export function staffEventDue(seed: number, week: number): boolean {
  return hash01(seed, week, 233) < 1 / BALANCE.staff.lifeEvents.cadenceWeeks;
}

/** Pick who the event is about: the LOW-MOOD teammate first (they need attention most), else a
 *  derived-hash pick among the eligible. Deterministic → the same week always picks the same person. */
export function pickLifeEventTarget(staff: readonly Staff[], week: number): Staff | null {
  const eligible = staff.filter((s) => lifeEventEligible(s, week));
  if (eligible.length === 0) return null;
  const struggling = eligible.filter((s) => moodBand(s.mood) === "burnedout" || moodBand(s.mood) === "tired");
  const pool = struggling.length > 0 ? struggling : eligible;
  // Stable: lowest mood first, then id — so a struggling person is surfaced before a content one.
  const sorted = [...pool].sort((a, b) => (a.mood !== b.mood ? a.mood - b.mood : a.id < b.id ? -1 : 1));
  const idx = struggling.length > 0 ? 0 : Math.floor(hash01(seed_of(staff), week, 2331) * sorted.length) % sorted.length;
  return sorted[idx];
}
// Derive a stable per-roster seed contribution from ids, so the pick varies by team without the sim RNG.
function seed_of(staff: readonly Staff[]): number {
  let h = 0;
  for (const s of staff) for (let i = 0; i < s.id.length; i++) h = (Math.imul(h, 31) + s.id.charCodeAt(i)) >>> 0;
  return h;
}

/** Build the life event for `target`, keyed to their mood / tenure / trait. Pure + deterministic. */
export function generateStaffEvent(target: Staff, seed: number, week: number): StaffLifeEvent {
  const band = moodBand(target.mood);
  const tenure = week - (target.hiredWeek ?? 0);
  const c = BALANCE.staff.lifeEvents;
  const base = { week, staffId: target.id, staffName: target.name, role: target.role };

  // Burnout — the most important beat: a struggling teammate is close to leaving.
  if (band === "burnedout" || band === "tired") {
    return {
      ...base,
      title: `${target.name} is running on empty`,
      body: `${target.name} has been stretched thin for weeks and is quietly eyeing the door. How do you respond?`,
      options: [
        { label: "Approve a sabbatical", blurb: "A real break — comes back recharged and loyal.", effect: { mood: 30, retainWeeks: c.retainWeeks } },
        { label: "Give a retention raise", blurb: `Costs ${format(c.raiseCost)}, but they feel valued.`, effect: { mood: 20, cashCost: c.raiseCost, retainWeeks: c.retainWeeks } },
        { label: "Ask them to push through", blurb: "Saves cash — but morale slips further.", effect: { mood: -8, teamMood: -3 } },
      ],
    };
  }

  // A tenured, senior teammate gets restless (or fields an outside offer).
  if (tenure >= c.restlessTenureWeeks && target.skill >= c.restlessSkill && hash01(seed, week, 2332) < 0.5) {
    return {
      ...base,
      title: `${target.name} wants a bigger challenge`,
      body: `${target.name} has outgrown their role and hinted at offers elsewhere. What's the play?`,
      options: [
        { label: "Fund a course", blurb: `Costs ${format(c.courseCost)} — they level up.`, effect: { skill: 1, mood: 12, cashCost: c.courseCost, retainWeeks: c.retainWeeks } },
        { label: "Give them a public win", blurb: "A high-profile project — pride and loyalty, no cash.", effect: { mood: 16, retainWeeks: Math.round(c.retainWeeks / 2) } },
        { label: "Let the itch pass", blurb: "Do nothing — and hope they stay.", effect: { mood: -6 } },
      ],
    };
  }

  // Otherwise a lighter, positive milestone.
  const partyKind = hash01(seed, week, 2333) < 0.5;
  return partyKind
    ? {
        ...base,
        title: `${target.name} hit a milestone`,
        body: `${target.name} just shipped something they're proud of. Mark the moment?`,
        options: [
          { label: "Throw a team party", blurb: `Costs ${format(c.partyCost)} — lifts the whole room.`, effect: { teamMood: 8, mood: 6, cashCost: c.partyCost } },
          { label: "Public shout-out", blurb: "Free — a genuine lift for them.", effect: { mood: 12 } },
          { label: "Note it and move on", blurb: "Keep the head down.", effect: {} },
        ],
      }
    : {
        ...base,
        title: `${target.name} has an idea`,
        body: `${target.name} wants a day to chase a side project. Give them room?`,
        options: [
          { label: "Give them the day", blurb: "A morale + creativity boost.", effect: { mood: 14 } },
          { label: "Fund a small prototype", blurb: `Costs ${format(c.protoCost)} — a real spark.`, effect: { mood: 16, cashCost: c.protoCost } },
          { label: "Not this week", blurb: "Ship first, play later.", effect: { mood: -4 } },
        ],
      };
}
