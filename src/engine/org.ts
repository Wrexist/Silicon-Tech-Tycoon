// Org structure / mentorship (Track C): a discipline LEAD speeds up the juniors working alongside
// them. Building a team around a senior anchor becomes a real strategy, and a high-skill veteran
// gains a second purpose beyond raw output. PURE.
import { BALANCE } from "./balance.ts";
import { ASSIGNMENT_DISCIPLINE, type Discipline } from "./staff.ts";
import type { Staff } from "./types.ts";

/** Read a member's 0..100 score in a discipline (corrupt/old saves → 0). */
function score(s: Staff, d: Discipline): number {
  const v = s.skills?.[d];
  return Number.isFinite(v) ? Math.max(0, v as number) : 0;
}

/** The lead of a discipline: the strongest person ACTIVELY working it (by that discipline's 0..100
 *  score). Null if no one is assigned to it. Deterministic — first-found wins a tie. */
export function disciplineLead(staff: readonly Staff[], discipline: Discipline): Staff | null {
  let best: Staff | null = null;
  let bestScore = -1;
  for (const s of staff) {
    if (s.assignment === "idle") continue;
    if (ASSIGNMENT_DISCIPLINE[s.assignment] !== discipline) continue;
    const sc = score(s, discipline);
    if (sc > bestScore) { best = s; bestScore = sc; }
  }
  return best;
}

/** The mentorship XP multiplier for a member this week (>= 1). A junior working a discipline learns
 *  faster when a MORE-skilled lead works the same one; the boost scales with the skill gap and is
 *  capped. The lead themselves, idle members, and anyone without a stronger lead get exactly 1. */
export function mentorshipXpMult(member: Staff, staff: readonly Staff[]): number {
  if (member.assignment === "idle") return 1;
  const discipline = ASSIGNMENT_DISCIPLINE[member.assignment];
  const lead = disciplineLead(staff, discipline);
  if (!lead || lead.id === member.id) return 1;
  const gap = score(lead, discipline) - score(member, discipline);
  const o = BALANCE.org;
  if (gap < o.minMentorGap) return 1;
  return 1 + Math.min(o.mentorMaxBonus, (gap - o.minMentorGap) * o.mentorPerGapPoint);
}

/** Whether this member is the lead of their assigned discipline (for UI badges). False when idle. */
export function isDisciplineLead(member: Staff, staff: readonly Staff[]): boolean {
  if (member.assignment === "idle") return false;
  return disciplineLead(staff, ASSIGNMENT_DISCIPLINE[member.assignment])?.id === member.id;
}
