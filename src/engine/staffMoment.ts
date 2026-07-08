// Staff growth moments — a tenured, senior staffer periodically earns a permanent character upgrade
// the PLAYER chooses: a second design specialty, a second (stacking) trait, or becoming a team mentor.
// Turns a long-serving team member from a static stat block into someone who visibly grows with the
// company. PURE + deterministic.
//
// Sim-safe by construction: the cadence is a DERIVED hash of (seed, week) — never the sim RNG — and
// the upgrade is player-CLAIMED via an opt-in reducer. The founder is never a target and the pinned
// solo sim runs founder-only, so it never fires or resolves one → byte-identical.
import { BALANCE } from "./balance.ts";
import { STAT_KEYS, type Specialty, type Staff, type StaffRole, type Trait } from "./types.ts";

export type StaffGrowthKind = "specialty" | "trait" | "mentor";

export interface StaffGrowthOption {
  kind: StaffGrowthKind;
  label: string;
  blurb: string;
  specialty?: Specialty; // set for kind "specialty"
  trait?: Trait;         // set for kind "trait"
}

export interface StaffMoment {
  week: number;
  staffId: string;
  staffName: string;
  role: StaffRole;
  skill: number;
  options: StaffGrowthOption[]; // 1–3 offered upgrades (only the ones this person hasn't earned yet)
}

/** Tiny deterministic hash → [0,1), same recipe as eureka / side orders — never the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Traits worth granting as a SECOND trait — all have a clean passive effect that stacks.
const GRANTABLE_TRAITS: readonly Trait[] = ["visionary", "fastLearner", "hustler", "perfectionist", "veteran", "teamPlayer"];

const SPECIALTY_LABEL: Record<Specialty, string> = {
  performance: "Performance",
  quality: "Quality",
  battery: "Battery",
  design: "Design",
  ecosystem: "Ecosystem",
};
const TRAIT_LABEL: Record<Trait, { label: string; blurb: string }> = {
  perfectionist: { label: "Perfectionist streak", blurb: "Also raises the design-tier ceiling." },
  fastLearner: { label: "Fast Learner streak", blurb: "Also gains skill XP 50% faster." },
  hustler: { label: "Hustler streak", blurb: "Also lifts their output by 20%." },
  visionary: { label: "Visionary streak", blurb: "Also adds extra hype to every launch." },
  veteran: { label: "Veteran poise", blurb: "Also steadies their output by 5%." },
  teamPlayer: { label: "Team Player streak", blurb: "Also lifts the whole team's mood." },
};

/** Has this person earned every growth upgrade already? (Then they're no longer a target.) */
export function fullyGrown(s: Staff): boolean {
  return !!s.secondSpecialty && !!s.bonusTrait && !!s.isMentor;
}

/** Whether a staffer is eligible for a growth moment: a senior, tenured, non-founder with room to grow. */
export function growthEligible(s: Staff, week: number): boolean {
  const g = BALANCE.staff.growth;
  if (s.id === "s0") return false; // the founder grows through the story, not this system
  if (s.skill < g.minSkill) return false;
  if (week - (s.hiredWeek ?? 0) < g.minTenureWeeks) return false;
  return !fullyGrown(s);
}

/** Should a growth moment fire this week? Roughly one per cadence window (deterministic). Callers gate
 *  on era / an eligible target / cooldown before consulting this. */
export function staffMomentDue(seed: number, week: number): boolean {
  return hash01(seed, week, 149) < 1 / BALANCE.staff.growth.cadenceWeeks;
}

/** The staffer who grows this week: the most senior eligible one (highest skill, then longest tenure,
 *  then id) — deterministic, so a given week always grows the same person. Null if none qualify. */
export function pickGrowthTarget(staff: readonly Staff[], week: number): Staff | null {
  const eligible = staff.filter((s) => growthEligible(s, week));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, s) => {
    if (s.skill !== best.skill) return s.skill > best.skill ? s : best;
    const tenure = week - (s.hiredWeek ?? 0);
    const bestTenure = week - (best.hiredWeek ?? 0);
    if (tenure !== bestTenure) return tenure > bestTenure ? s : best;
    return s.id < best.id ? s : best;
  });
}

/** Build the moment for `target`: offer only the upgrades they haven't earned, with concrete picks
 *  (a specific second specialty + a specific second trait) chosen deterministically. Pure. */
export function generateStaffMoment(target: Staff, seed: number, week: number): StaffMoment {
  const options: StaffGrowthOption[] = [];

  if (!target.secondSpecialty) {
    const pool = STAT_KEYS.filter((k) => k !== target.specialty);
    const spec = pool[Math.floor(hash01(seed, week, 151) * pool.length) % pool.length] as Specialty;
    options.push({
      kind: "specialty",
      label: `${SPECIALTY_LABEL[spec]} mastery`,
      blurb: `Cross-trains into ${SPECIALTY_LABEL[spec]} — a second stat they lift on Design.`,
      specialty: spec,
    });
  }
  if (!target.bonusTrait) {
    const pool = GRANTABLE_TRAITS.filter((t) => t !== target.trait);
    const trait = pool[Math.floor(hash01(seed, week, 157) * pool.length) % pool.length] as Trait;
    options.push({
      kind: "trait",
      label: TRAIT_LABEL[trait].label,
      blurb: TRAIT_LABEL[trait].blurb,
      trait,
    });
  }
  if (!target.isMentor) {
    options.push({
      kind: "mentor",
      label: "Team mentor",
      blurb: `Mentors the whole team — +${Math.round(BALANCE.staff.growth.mentorXpBonus * 100)}% weekly XP for everyone else.`,
    });
  }

  return { week, staffId: target.id, staffName: target.name, role: target.role, skill: target.skill, options };
}

/** The company-wide XP multiplier a member gets from OTHER staffers who mentor the team (>= 1, capped).
 *  A member's own mentor flag doesn't boost themselves. Solo/founder team → no mentors → exactly 1. */
export function mentorTeamXpMult(staff: readonly Staff[], member: Staff): number {
  const g = BALANCE.staff.growth;
  const mentors = staff.reduce((n, s) => n + (s.isMentor && s.id !== member.id ? 1 : 0), 0);
  return 1 + Math.min(g.mentorXpCap, mentors * g.mentorXpBonus);
}
