// Staff identity — appearance, specialty, trait, mood — plus their gameplay effects. PURE.
import type { Rng } from "./rng.ts";
import { STAT_KEYS } from "./types.ts";
import type {
  Accessory,
  Appearance,
  Skills,
  Specialty,
  Staff,
  StaffRole,
  StatKey,
  Trait,
} from "./types.ts";

// ---------- Character palettes (intrinsic to a person, not theme-dependent) ----------
export const SKIN_TONES = ["#f4c9a8", "#e8b48c", "#d39b6e", "#b97a4e", "#8d5524", "#5c3a1e"];
export const HAIR_COLORS = ["#2a2623", "#4a3526", "#6b4a2f", "#b07b3e", "#d9c08a", "#9aa0a6", "#3b6fd4", "#c84e8f"];
export const SHIRT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899", "#64748b"];
export const HAIRSTYLE_COUNT = 6; // 0 short,1 buzz,2 bun,3 long,4 curly,5 bald (interpreted by renderer)
export const ACCESSORIES: Accessory[] = ["none", "glasses", "headphones", "cap", "beanie", "earrings"];

// ---------- Flavor ----------
export const SPECIALTY_TITLE: Record<Specialty, string> = {
  performance: "Chip Wizard",
  quality: "Display Artisan",
  battery: "Battery Guru",
  design: "Industrial Designer",
  ecosystem: "Ecosystem Architect",
};

export interface TraitInfo {
  label: string;
  blurb: string;
}
export const TRAIT_INFO: Record<Trait, TraitInfo> = {
  perfectionist: { label: "Perfectionist", blurb: "Raises the design ceiling, but is hard to please." },
  fastLearner: { label: "Fast Learner", blurb: "Gains skill XP 50% faster." },
  hustler: { label: "Hustler", blurb: "+20% output, but runs themselves down." },
  visionary: { label: "Visionary", blurb: "Adds extra hype to every launch." },
  veteran: { label: "Veteran", blurb: "Starts highly skilled; steady output." },
  teamPlayer: { label: "Team Player", blurb: "Lifts the whole team's mood." },
};

const ALL_TRAITS: Trait[] = ["perfectionist", "fastLearner", "hustler", "visionary", "veteran", "teamPlayer"];

// ---------- Generation ----------
function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rng.int(arr.length)];
}

/** Specialties skew by role but stay varied. */
function rollSpecialty(rng: Rng, role: StaffRole): Specialty {
  const weighted: Record<StaffRole, Specialty[]> = {
    engineer: ["performance", "performance", "battery", "ecosystem", "quality"],
    designer: ["design", "design", "quality", "performance", "battery"],
    marketer: ["ecosystem", "ecosystem", "design", "quality", "performance"],
  };
  return pick(rng, weighted[role]);
}

/** Safe fallback so a corrupt/partial save never crashes the character renderers. */
export const DEFAULT_APPEARANCE: Appearance = { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" };

export function makeAppearance(rng: Rng): Appearance {
  return {
    skin: rng.int(SKIN_TONES.length),
    hair: rng.int(HAIRSTYLE_COUNT),
    hairColor: rng.int(HAIR_COLORS.length),
    shirt: rng.int(SHIRT_COLORS.length),
    accessory: pick(rng, ACCESSORIES),
  };
}

export interface Identity {
  specialty: Specialty;
  trait: Trait;
  mood: number;
  appearance: Appearance;
}

export function makeIdentity(rng: Rng, role: StaffRole): Identity {
  return {
    specialty: rollSpecialty(rng, role),
    trait: pick(rng, ALL_TRAITS),
    mood: Math.round(rng.range(58, 78)),
    appearance: makeAppearance(rng),
  };
}

// ---------- Per-discipline skills (0..100) — the "good at different things" model ----------
export type Discipline = "engineering" | "design" | "marketing";
export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  engineering: "Engineering",
  design: "Design",
  marketing: "Marketing",
};
/** Which discipline a role headlines. */
export const ROLE_DISCIPLINE: Record<StaffRole, Discipline> = {
  engineer: "engineering",
  designer: "design",
  marketer: "marketing",
};

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** A 0..100 skill profile centred on `level` (1..10): the role's discipline is strongest, the
 *  others scatter lower. Produces visibly different people — a 90/30/50 vs a 40/40/70. */
export function makeSkills(rng: Rng, role: StaffRole, level: number): Skills {
  const primary = ROLE_DISCIPLINE[role];
  const base = level * 10; // 1..10 -> ~10..100
  const out: Skills = {
    engineering: clamp100(rng.range(15, 55)),
    design: clamp100(rng.range(15, 55)),
    marketing: clamp100(rng.range(15, 55)),
  };
  out[primary] = clamp100(base + rng.range(-8, 10)); // strongest, near the headline level
  return out;
}

/** Headline skill level (1..10) derived from a 0..100 profile for a role (its primary discipline). */
export function levelFromSkills(skills: Skills, role: StaffRole): number {
  return Math.max(1, Math.min(10, Math.round(skills[ROLE_DISCIPLINE[role]] / 10)));
}

// ---------- Mood ----------
export type MoodBand = "thriving" | "happy" | "neutral" | "tired" | "burnedout";
export function moodBand(mood: number): MoodBand {
  if (mood >= 80) return "thriving";
  if (mood >= 60) return "happy";
  if (mood >= 40) return "neutral";
  if (mood >= 20) return "tired";
  return "burnedout";
}
export const MOOD_LABEL: Record<MoodBand, string> = {
  thriving: "Thriving",
  happy: "Happy",
  neutral: "Steady",
  tired: "Tired",
  burnedout: "Burned out",
};
export const MOOD_COLOR: Record<MoodBand, string> = {
  thriving: "var(--positive)",
  happy: "var(--positive)",
  neutral: "var(--ink-2)",
  tired: "var(--warning)",
  burnedout: "var(--negative)",
};

/** 0.82 (burned out) .. 1.18 (thriving) multiplier on a person's output. */
export function moodMult(mood: number): number {
  return 0.82 + (Math.max(0, Math.min(100, mood)) / 100) * 0.36;
}

// ---------- Trait effects ----------
export function traitOutputMult(t: Trait): number {
  if (t === "hustler") return 1.2;
  if (t === "veteran") return 1.05;
  return 1;
}
export function xpMult(t: Trait): number {
  return t === "fastLearner" ? 1.5 : 1;
}
export function isPerfectionist(s: Staff): boolean {
  return s.trait === "perfectionist";
}

/** A person's effective contribution to whatever they're assigned to. */
export function output(s: Staff): number {
  const skill = Number.isFinite(s.skill) ? Math.max(0, s.skill) : 0; // immunize the sim from a corrupt skill
  return skill * moodMult(s.mood) * traitOutputMult(s.trait);
}

/** Build-time stat bonus from designers (assigned to Design) whose specialty matches a stat. */
export function designSpecialtyBonus(staff: readonly Staff[]): Partial<Record<StatKey, number>> {
  const bonus: Partial<Record<StatKey, number>> = {};
  for (const s of staff) {
    if (s.assignment !== "design") continue;
    const amt = 1.2 * Math.sqrt(Math.max(0, s.skill || 0)) * moodMult(s.mood);
    bonus[s.specialty] = (bonus[s.specialty] ?? 0) + amt;
  }
  return bonus;
}

/** Extra launch hype from visionaries assigned to marketing. */
export function visionaryHype(staff: readonly Staff[]): number {
  let h = 0;
  for (const s of staff) if (s.trait === "visionary" && s.assignment === "marketing") h += 0.12;
  return h;
}

/** Perfectionist designers each lift the design-tier ceiling by 1. */
export function perfectionistCeilingBonus(staff: readonly Staff[]): number {
  return staff.filter((s) => s.assignment === "design" && s.trait === "perfectionist").length;
}

export { STAT_KEYS };
