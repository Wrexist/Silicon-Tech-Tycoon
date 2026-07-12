// Staff identity — appearance, specialty, trait, mood — plus their gameplay effects. PURE.
import { BALANCE } from "./balance.ts";
import type { Rng } from "./rng.ts";
import type {
  Accessory,
  Appearance,
  Assignment,
  Skills,
  Specialty,
  Staff,
  StaffRole,
  StatKey,
  Trait,
} from "./types.ts";

// ---------- Character palettes (intrinsic to a person, not theme-dependent) ----------
const SKIN_TONES = ["#f4c9a8", "#e8b48c", "#d39b6e", "#b97a4e", "#8d5524", "#5c3a1e"];
const HAIR_COLORS = ["#2a2623", "#4a3526", "#6b4a2f", "#b07b3e", "#d9c08a", "#9aa0a6", "#3b6fd4", "#c84e8f"];
const SHIRT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899", "#64748b"];
const HAIRSTYLE_COUNT = 6; // 0 short,1 buzz,2 bun,3 long,4 curly,5 bald (interpreted by renderer)
const ACCESSORIES: Accessory[] = ["none", "glasses", "headphones", "cap", "beanie", "earrings"];

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

// ---------- Names & bios (item 2.1) — every hire is a CHARACTER, not a recycled first name ----------
// Full first+last names from coprime strides over the two pools, so a game's ~dozen hires almost
// never collide (the old code recycled 16 first-names by modulo → routine duplicate "Riley"s).
const FIRST_NAMES = [
  "Riley", "Sam", "Jordan", "Casey", "Ari", "Noa", "Quinn", "Devin", "Max", "Robin", "Sky", "Frankie",
  "Ellis", "Rowan", "Tatum", "Wren", "Priya", "Kenji", "Mateo", "Layla", "Omar", "Ines", "Yuki", "Dax",
  "Nadia", "Theo", "Zoe", "Idris", "Mira", "Cyrus", "Leena", "Bo",
];
const LAST_NAMES = [
  "Chen", "Okafor", "Nakamura", "Silva", "Kowalski", "Reyes", "Haddad", "Novak", "Bauer", "Mensah",
  "Rossi", "Kim", "Andersson", "Patel", "Vance", "Oyelaran", "Sato", "Moreau", "Costa", "Ibrahim",
  "Lindqvist", "Delgado", "Fischer", "Adeyemi", "Petrov", "Nguyen", "Marsh", "Cabrera", "Halvorsen", "Ferro",
];

/** A stable full name for the hire with counter `index` — coprime strides keep collisions rare. */
export function staffName(index: number): string {
  const first = FIRST_NAMES[Math.abs(index * 7) % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.abs(index * 13 + 5) % LAST_NAMES.length];
  return `${first} ${last}`;
}

// One-line character hook, chosen deterministically by (trait, index). Keeps hires memorable and makes
// losing someone to poaching actually sting. Purely cosmetic — never read by the sim.
const BIO_BY_TRAIT: Record<Trait, string[]> = {
  perfectionist: ["Redlines every spec twice — ships nothing they're ashamed of.", "Keeps a drawer of rejected prototypes as a warning.", "Will hold a launch over a half-pixel seam."],
  fastLearner: ["Picked up three toolchains last quarter — allergic to standing still.", "Reads the changelog for fun.", "Onboarded in a week, mentored a junior in two."],
  hustler: ["First in, last out — runs on cold brew and deadlines.", "Ships on Fridays out of spite.", "Turned a weekend hack into a shipping feature."],
  visionary: ["Pitches ten-year roadmaps in elevator rides.", "Sketches the next three devices on napkins.", "Already bored of the thing you're launching."],
  veteran: ["Shipped devices you grew up with — unflappable in a crunch.", "Has a war story for every bug.", "Seen three platform wars; picks their battles."],
  teamPlayer: ["The glue of every standup — remembers everyone's coffee order.", "Unblocks two people before their first coffee.", "Throws the best release party in the building."],
};
const ORIGIN_BY_SPECIALTY: Record<Specialty, string> = {
  performance: "ex-silicon startup",
  quality: "former display lab",
  battery: "ex-cell chemist",
  design: "art-school dropout",
  ecosystem: "ex-platform team",
};

/** A one-line bio/quirk for a hire — a trait-driven hook plus a specialty origin. Deterministic
 *  (trait + specialty + index), RNG-free, cosmetic. */
export function staffBio(trait: Trait, specialty: Specialty, index: number): string {
  const list = BIO_BY_TRAIT[trait];
  const hook = list[Math.abs(index * 5 + 2) % list.length];
  return `${ORIGIN_BY_SPECIALTY[specialty]} · ${hook}`;
}

/** Human-readable role title for feed/log lines. The three product roles keep their lowercase wording
 *  (existing copy unchanged); the specialists get a proper title so "Hired Riley, hr." never ships. */
export const ROLE_TITLE: Record<StaffRole, string> = {
  engineer: "engineer",
  designer: "designer",
  marketer: "marketer",
  hr: "People Lead",
  researcher: "Lead Researcher",
};

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
    // Specialists lean into their function's flavour: a Lead Researcher skews to raw tech, a People
    // Lead toward the ecosystem/people side. (Cosmetic: specialists don't build products directly.)
    researcher: ["performance", "ecosystem", "performance", "battery", "quality"],
    hr: ["ecosystem", "ecosystem", "quality", "design", "performance"],
  };
  return pick(rng, weighted[role]);
}

/** Safe fallback so a corrupt/partial save never crashes the character renderers. */
export const DEFAULT_APPEARANCE: Appearance = { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" };

function makeAppearance(rng: Rng): Appearance {
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
  // Specialists still headline a discipline for the skill model: a Lead Researcher is an R&D mind
  // (engineering); a People Lead headlines the people/comms side (marketing).
  researcher: "engineering",
  hr: "marketing",
};

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** A 0..100 skill profile centred on `level` (1..10): the role's discipline is ALWAYS their
 *  strongest, the others scatter strictly below it. So an "Engineer" is genuinely best at
 *  engineering (role label, headline level, and best-fit advice all agree), while people still
 *  vary in their secondary strengths — a 90/30/50 vs a 40/35/20. */
export function makeSkills(rng: Rng, role: StaffRole, level: number): Skills {
  const primary = ROLE_DISCIPLINE[role];
  const base = level * 10; // 1..10 -> ~10..100
  const primaryScore = clamp100(base + rng.range(-8, 10)); // strongest, near the headline level
  // Off-disciplines are a fraction (35–85%) of the primary, so they vary per person yet can never
  // eclipse the role's headline skill — the primary is always strictly the strongest.
  const off = () => clamp100(Math.round(primaryScore * rng.range(0.35, 0.85)));
  const out: Skills = {
    engineering: off(),
    design: off(),
    marketing: off(),
  };
  out[primary] = primaryScore;
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
function moodMult(mood: number): number {
  return 0.82 + (Math.max(0, Math.min(100, mood)) / 100) * 0.36;
}

// ---------- Trait effects ----------
function traitOutputMult(t: Trait): number {
  if (t === "hustler") return 1.2;
  if (t === "veteran") return 1.05;
  return 1;
}
export function xpMult(t: Trait): number {
  return t === "fastLearner" ? 1.5 : 1;
}

/** A person's combined output multiplier from BOTH their primary trait and any earned bonus trait
 *  (growth moments). The bonus trait stacks multiplicatively; undefined → just the primary → unchanged. */
function combinedOutputMult(s: Staff): number {
  const base = traitOutputMult(s.trait);
  return s.bonusTrait && s.bonusTrait !== s.trait ? base * traitOutputMult(s.bonusTrait) : base;
}

/** A person's combined weekly-XP multiplier from primary + bonus trait (fastLearner stacks). */
export function staffXpMult(s: Staff): number {
  const base = xpMult(s.trait);
  return s.bonusTrait && s.bonusTrait !== s.trait ? base * xpMult(s.bonusTrait) : base;
}

/** A person's headline effectiveness (uses their 1..10 level). Kept for any generic use. */
export function output(s: Staff): number {
  const skill = Number.isFinite(s.skill) ? Math.max(0, s.skill) : 0; // immunize the sim from a corrupt skill
  return skill * moodMult(s.mood) * combinedOutputMult(s);
}

/** Which 0..100 discipline a given task draws on. This is what makes people "good at different
 *  things" actually matter: put someone on the work their high score covers. */
export const ASSIGNMENT_DISCIPLINE: Record<Exclude<Assignment, "idle">, Discipline> = {
  rnd: "engineering",
  design: "design",
  marketing: "marketing",
};

/** Read a 0..100 discipline safely (corrupt/old saves → 0). */
function disciplineScore(s: Staff, d: Discipline): number {
  const v = s.skills?.[d];
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

/** A person's effective contribution to a specific discipline of work, on the SAME 1..10-ish
 *  scale as `output()` (so existing balance holds when people work their primary discipline). */
export function disciplineOutput(s: Staff, d: Discipline): number {
  return (disciplineScore(s, d) / 10) * moodMult(s.mood) * combinedOutputMult(s);
}

/** Build-time stat bonus from designers (assigned to Design) whose specialty matches a stat —
 *  scaled by their Design discipline. A growth-earned SECOND specialty adds a (lighter) bonus too. */
export function designSpecialtyBonus(staff: readonly Staff[]): Partial<Record<StatKey, number>> {
  const bonus: Partial<Record<StatKey, number>> = {};
  for (const s of staff) {
    if (s.assignment !== "design") continue;
    const amt = 1.2 * Math.sqrt(disciplineScore(s, "design") / 10) * moodMult(s.mood);
    bonus[s.specialty] = (bonus[s.specialty] ?? 0) + amt;
    if (s.secondSpecialty && s.secondSpecialty !== s.specialty) {
      bonus[s.secondSpecialty] = (bonus[s.secondSpecialty] ?? 0) + amt * BALANCE.staff.growth.secondSpecialtyWeight;
    }
  }
  return bonus;
}

/** Does this person carry the given trait, whether as their primary or a growth-earned bonus trait? */
function hasTrait(s: Staff, t: Trait): boolean {
  return s.trait === t || s.bonusTrait === t;
}

/** Extra launch hype from visionaries (primary or bonus trait) assigned to marketing. */
export function visionaryHype(staff: readonly Staff[]): number {
  let h = 0;
  for (const s of staff) if (hasTrait(s, "visionary") && s.assignment === "marketing") h += 0.12;
  return h;
}

/** Perfectionist designers (primary or bonus trait) each lift the design-tier ceiling by 1. */
export function perfectionistCeilingBonus(staff: readonly Staff[]): number {
  return staff.filter((s) => s.assignment === "design" && hasTrait(s, "perfectionist")).length;
}
