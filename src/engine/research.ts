// Research Points economy + company Research Projects. PURE.
import { BALANCE } from "./balance.ts";
import { disciplineOutput } from "./staff.ts";
import type { Staff } from "./types.ts";

export type ProjectId =
  | "assemblyLine"
  | "leanSupply"
  | "brandStudio"
  | "talentNetwork"
  | "globalDistribution"
  | "qaLab"
  | "prototypeBench"
  | "demandSensing"
  | "loyaltyProgram"
  | "marketingAutomation"
  | "verticalIntegration"
  | "hitFactory"
  | "contentMarketing"
  | "quickPrototype"
  | "megaLaunch"
  | "componentStandards"
  | "pressKit"
  | "brandManual"
  | "crisisComms"
  | "perfHouse"
  | "effHouse"
  | "qualityHouse"
  | "peopleOps"
  | "researchDivision";

export interface ResearchProject {
  id: ProjectId;
  name: string;
  blurb: string;
  rpCost: number;
  era: number; // minimum era to research
  /** Research-tree FORK (Track D): projects sharing a fork id are MUTUALLY EXCLUSIVE — choosing one
   *  permanently locks out its siblings, so the company commits to a doctrine (a distinct playstyle)
   *  rather than buying everything. Undefined = an ordinary, independently-researchable project. */
  fork?: string;
}

export const RESEARCH_PROJECTS: ResearchProject[] = [
  // Era 1 — Garage Era
  { id: "assemblyLine",       name: "Assembly Line",        blurb: "Manufacture products faster.",               rpCost: 28,  era: 1 },
  { id: "leanSupply",         name: "Lean Supply Chain",    blurb: "Cut per-unit build cost by 15%.",            rpCost: 44,  era: 1 },
  { id: "qaLab",              name: "QA Lab",               blurb: "Bigger reputation gains, softer flops.",     rpCost: 38,  era: 1 },
  { id: "prototypeBench",     name: "Prototype Bench",      blurb: "Component tier unlocks cost 20% fewer RP.",  rpCost: 32,  era: 1 },
  // Era 2 — Growth Era
  { id: "talentNetwork",      name: "Talent Network",       blurb: "Hiring fees 40% cheaper.",                   rpCost: 52,  era: 2 },
  { id: "brandStudio",        name: "Brand Studio",         blurb: "Every launch gets more hype.",               rpCost: 66,  era: 2 },
  { id: "demandSensing",      name: "Demand Sensing",       blurb: "Demand forecasts are 35% more accurate.",    rpCost: 62,  era: 2 },
  { id: "loyaltyProgram",     name: "Loyalty Program",      blurb: "Fan base decays 50% more slowly.",           rpCost: 80,  era: 2 },
  { id: "contentMarketing",   name: "Content Marketing",    blurb: "+100 fans per week from organic social presence.", rpCost: 72, era: 2 },
  { id: "quickPrototype",     name: "Quick Prototype",      blurb: "Production runs complete 1 week faster.",    rpCost: 55,  era: 2 },
  // Era 3 — Platform Era
  { id: "globalDistribution", name: "Global Distribution",  blurb: "Reach 25% more customers.",                  rpCost: 96,  era: 3 },
  { id: "marketingAutomation",name: "Marketing Automation", blurb: "All launches get a free +20% hype boost.",   rpCost: 90,  era: 3 },
  { id: "verticalIntegration",name: "Vertical Integration", blurb: "Manufacturing costs 20% lower.",             rpCost: 115, era: 3 },
  { id: "hitFactory",         name: "Hit Factory",          blurb: "Hit threshold lowers, more products qualify.", rpCost: 130, era: 3 },
  { id: "megaLaunch",         name: "Mega Launch",          blurb: "+0.3 hype multiplier stacked on every launch.", rpCost: 140, era: 3 },
  // Expansion projects — new unlocks across all eras
  { id: "componentStandards", name: "Component Standards",  blurb: "Component tier R&D costs 15% less RP.",      rpCost: 30,  era: 1 },
  { id: "pressKit",           name: "Press Kit",            blurb: "Every product launch earns +1 reputation.",  rpCost: 20,  era: 1 },
  { id: "brandManual",        name: "Brand Manual",         blurb: "+4 Design stat on every product you ship.",  rpCost: 58,  era: 2 },
  { id: "crisisComms",        name: "Crisis Comms",         blurb: "Flop reputation penalty halved.",            rpCost: 76,  era: 3 },
  // Engineering Doctrine — a MUTUALLY-EXCLUSIVE fork (Track D). Commit your company to ONE house; the
  // others lock out. Each stamps a permanent stat identity on every product you ship, which pairs with
  // the category buyer mixes (a Performance house thrives in Pro-led categories, Reliability in
  // enterprise/mainstream, Efficiency in value-led ones) — a real, lasting playstyle choice.
  { id: "perfHouse",    name: "Performance House",  blurb: "Commit to raw power: +5 Performance on every product (locks the other doctrines).", rpCost: 70, era: 2, fork: "engDoctrine" },
  { id: "effHouse",     name: "Efficiency House",   blurb: "Commit to endurance: +5 Battery on every product (locks the other doctrines).",     rpCost: 70, era: 2, fork: "engDoctrine" },
  { id: "qualityHouse", name: "Reliability House",  blurb: "Commit to craft: +5 Quality on every product (locks the other doctrines).",         rpCost: 70, era: 2, fork: "engDoctrine" },
  // Delegation divisions: premium, late-tree investments that OPEN a specialist hire. Each only pays
  // off once you recruit the matching specialist (whose salary is the standing weekly cost), so the RP
  // here buys the right to delegate, not the automation itself.
  { id: "peopleOps",        name: "People Operations", blurb: "Open a People Ops desk: recruit a People Lead to delegate staffing (Auto-assign).", rpCost: 120, era: 2 },
  { id: "researchDivision", name: "Research Division",  blurb: "Stand up an R&D division: recruit a Lead Researcher to delegate the tree (Auto-research).", rpCost: 120, era: 2 },
];

/** The completed project that LOCKS a forked project `id` (a sibling in the same fork already chosen),
 *  or null if `id` is free to research. Used to gate the buy and to grey out the locked siblings. */
export function forkLockedBy(completed: readonly ProjectId[], id: ProjectId): ProjectId | null {
  const fork = RESEARCH_PROJECTS.find((p) => p.id === id)?.fork;
  if (!fork) return null;
  for (const c of completed) {
    if (c === id) continue;
    if (RESEARCH_PROJECTS.find((p) => p.id === c)?.fork === fork) return c;
  }
  return null;
}

export function projectById(id: ProjectId): ResearchProject {
  // Never throw on an unknown id (a future content/gate pointing at a missing project): return a
  // safe placeholder (the id stands in as the name, visible in dev) instead of a hard crash.
  return RESEARCH_PROJECTS.find((p) => p.id === id) ?? { id, name: id, blurb: "", rpCost: 0, era: 1 };
}

/** The maximum number of projects a single company can ever complete: every non-forked project, plus
 *  ONE per fork group (the others lock out). The "research everything" achievement targets this, since
 *  completing the full RESEARCH_PROJECTS list is impossible once forks exist. */
export function completableProjectCount(): number {
  const forks = new Set<string>();
  let count = 0;
  for (const p of RESEARCH_PROJECTS) {
    if (p.fork) forks.add(p.fork);
    else count++;
  }
  return count + forks.size;
}

/** Weekly RP generated by staff assigned to R&D (+ founder trickle), scaled by era. */
export function weeklyRp(staff: readonly Staff[], era: number): number {
  let rp = BALANCE.research.rpFounderBase;
  for (const s of staff) {
    if (s.assignment !== "rnd") continue;
    // R&D draws on the person's Engineering discipline (0..100). Engineers naturally score high
    // here; a non-engineer with decent Engineering still contributes.
    const per =
      s.role === "engineer"
        ? BALANCE.research.rpPerEngineerSkill
        : BALANCE.research.rpPerAssignedResearcher;
    rp += disciplineOutput(s, "engineering") * per;
  }
  const len = BALANCE.research.eraMultiplier.length;
  const mult = BALANCE.research.eraMultiplier[Math.max(1, Math.min(era, len)) - 1];
  return rp * mult;
}

/** One contributor to weekly RP, for the legibility breakdown. `id` is the staff id ("founder" for
 *  the founder trickle); `rp` is that source's weekly RP at the era scale. */
export interface RpSource {
  id: string;
  label: string;
  rp: number;
}

/** Itemized weekly RP by source (founder trickle + each R&D-assigned staffer), at the era scale.
 *  The sum equals weeklyRp(staff, era) exactly — a test pins this so the two never diverge. Pure. */
export function rpSources(staff: readonly Staff[], era: number): RpSource[] {
  const len = BALANCE.research.eraMultiplier.length;
  const mult = BALANCE.research.eraMultiplier[Math.max(1, Math.min(era, len)) - 1];
  const out: RpSource[] = [{ id: "founder", label: "Founder", rp: BALANCE.research.rpFounderBase * mult }];
  for (const s of staff) {
    if (s.assignment !== "rnd") continue;
    const per = s.role === "engineer" ? BALANCE.research.rpPerEngineerSkill : BALANCE.research.rpPerAssignedResearcher;
    out.push({ id: s.id, label: s.name, rp: disciplineOutput(s, "engineering") * per * mult });
  }
  return out;
}

/** Convert an old cash R&D cost into an RP cost for a component tier. */
export function techRpCost(cashRdCost: number): number {
  return Math.max(BALANCE.research.minTechRp, Math.round(cashRdCost * BALANCE.research.rdCashToRp));
}

/** RP awarded for a launch outcome — a strong launch funds the next breakthrough, so research is
 *  earned through PLAY, not only idle ticks. Flops + steady sellers award nothing. */
export function launchRpReward(verdict: "hit" | "solid" | "flop" | "steady"): number {
  const r = BALANCE.research;
  return verdict === "hit" ? r.launchRpHit : verdict === "solid" ? r.launchRpSolid : 0;
}

export function hasProject(completed: readonly ProjectId[], id: ProjectId): boolean {
  return completed.includes(id);
}
