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
  | "researchDivision"
  | "aiCopilot"
  | "lightsOut"
  | "predictiveSupply"
  | "neuralMarketing"
  | "gtmHype"
  | "gtmDesign"
  | "gtmPrestige"
  | "opsSpeed"
  | "opsCost"
  | "opsReach"
  // Era CAPSTONES (item 4.2) — deep, prerequisite-gated end-of-tree projects.
  | "growthEngine"
  | "platformDominance"
  | "singularityLab"
  // Doctrine tier-2 projects (item 4.4) — each requires the matching engineering House.
  | "overclockLab"
  | "enduranceCells"
  | "zeroDefectLine"
  // Autonomy Era (era 5, post-IPO) — the frontier tree.
  | "frontierLabs"
  | "autonomousOps"
  | "autonomyLab";

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
  /** Item 4.2 — PREREQUISITES: every listed project must be completed before this one can be
   *  researched. Turns the flat checklist into a tree with real route-planning (capstones sit at the
   *  end of a prerequisite chain). Undefined = no prerequisites. */
  requires?: ProjectId[];
  /** Item 4.2 — a flag for the end-of-era capstone projects (deep RP sinks with the strongest
   *  payoffs), used purely for UI grouping/labelling. */
  capstone?: boolean;
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
  // Era 4 — AI Era: the arrival finally ships its own breakthroughs (eras 2–3 always did), so the
  // last era transition feels like a frontier, not a footnote. Costs sit above era 3's ceiling —
  // by now RP income is era-multiplied and launch rewards flow, so these are the endgame's sinks.
  { id: "aiCopilot",          name: "AI Copilot Suite",     blurb: "+4 Ecosystem on every product you ship.",    rpCost: 160, era: 4 },
  { id: "lightsOut",          name: "Lights-Out Assembly",  blurb: "Production runs complete 1 week faster.",    rpCost: 175, era: 4 },
  { id: "predictiveSupply",   name: "Predictive Supply AI", blurb: "Per-unit build cost a further 10% lower.",   rpCost: 185, era: 4 },
  { id: "neuralMarketing",    name: "Neural Marketing",     blurb: "+0.25 hype multiplier on every launch.",     rpCost: 200, era: 4 },
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
  // Go-to-Market Doctrine — a second MUTUALLY-EXCLUSIVE fork: commit to ONE way of winning the
  // customer (the others lock out). Layers a distinct market identity on top of the engineering house.
  { id: "gtmHype",     name: "Hype House",     blurb: "Win on marketing: +0.30 hype on every launch (locks the other GTM houses).",   rpCost: 74, era: 2, fork: "gtmDoctrine" },
  { id: "gtmDesign",   name: "Design House",   blurb: "Win on desirability: +6 Design on every product (locks the other GTM houses).", rpCost: 74, era: 2, fork: "gtmDoctrine" },
  { id: "gtmPrestige", name: "Prestige House", blurb: "Win on brand: +2 reputation from every launch (locks the other GTM houses).",   rpCost: 74, era: 2, fork: "gtmDoctrine" },
  // Operations Doctrine — a third MUTUALLY-EXCLUSIVE fork: commit to ONE way of running the factory.
  { id: "opsSpeed", name: "Speed House", blurb: "Run fast: production runs finish 1 week sooner (locks the other Ops houses).", rpCost: 118, era: 3, fork: "opsDoctrine" },
  { id: "opsCost",  name: "Cost House",  blurb: "Run cheap: per-unit build cost 18% lower (locks the other Ops houses).",        rpCost: 118, era: 3, fork: "opsDoctrine" },
  { id: "opsReach", name: "Reach House", blurb: "Run wide: reach 25% more customers (locks the other Ops houses).",              rpCost: 118, era: 3, fork: "opsDoctrine" },
  // Delegation divisions: premium, late-tree investments that OPEN a specialist hire. Each only pays
  // off once you recruit the matching specialist (whose salary is the standing weekly cost), so the RP
  // here buys the right to delegate, not the automation itself.
  { id: "peopleOps",        name: "People Operations", blurb: "Open a People Ops desk: recruit a People Lead to delegate staffing (Auto-assign).", rpCost: 120, era: 2 },
  { id: "researchDivision", name: "Research Division",  blurb: "Stand up an R&D division: recruit a Lead Researcher to delegate the tree (Auto-research).", rpCost: 120, era: 2 },
  // Era CAPSTONES (item 4.2) — the end of each era's tree. Each REQUIRES two earlier projects, so it
  // sits behind a deliberate route (not a checklist buy), and pays a strong compound bonus. Deep RP
  // sinks that give the late tree somewhere to spend. Reachability is property-tested.
  // Doctrine tier-2 projects (item 4.4): a deeper commitment unlocked ONLY once you've chosen the
  // matching engineering House (item 4.2 `requires`). Since the House is a fork, at most one of these
  // is ever reachable — the doctrine you committed to keeps paying off deeper into the tree.
  { id: "overclockLab",   name: "Overclock Lab",    blurb: "Performance doctrine: a further +4 Performance on every product.", rpCost: 150, era: 3, requires: ["perfHouse"] },
  { id: "enduranceCells", name: "Endurance Cells",  blurb: "Efficiency doctrine: a further +4 Battery on every product.",     rpCost: 150, era: 3, requires: ["effHouse"] },
  { id: "zeroDefectLine", name: "Zero-Defect Line", blurb: "Reliability doctrine: a further +4 Quality on every product.",    rpCost: 150, era: 3, requires: ["qualityHouse"] },
  { id: "growthEngine",      name: "Growth Engine",       blurb: "Capstone: +0.20 hype and 25% slower fan decay stack on your growth machine.", rpCost: 220, era: 2, capstone: true, requires: ["brandStudio", "loyaltyProgram"] },
  { id: "platformDominance", name: "Platform Dominance",  blurb: "Capstone: reach 15% more customers and a further 10% off unit cost.",           rpCost: 340, era: 3, capstone: true, requires: ["globalDistribution", "verticalIntegration"] },
  { id: "singularityLab",    name: "Singularity Lab",     blurb: "Capstone: +3 Ecosystem on every product and +0.20 hype on every launch.",       rpCost: 420, era: 4, capstone: true, requires: ["aiCopilot", "neuralMarketing"] },
  // Era 5 — Autonomy Era (post-IPO). The frontier tree: the endgame's deepest RP sinks, only reachable
  // once you've gone public and pushed into era 5.
  { id: "frontierLabs",   name: "Frontier Labs",         blurb: "+6 Ecosystem on every product you ship.",          rpCost: 320, era: 5 },
  { id: "autonomousOps",  name: "Autonomous Operations", blurb: "Production runs complete 1 week faster.",          rpCost: 340, era: 5 },
  { id: "autonomyLab",    name: "Autonomy Lab",          blurb: "Capstone: +5 Ecosystem on every product and +0.25 hype on every launch.", rpCost: 560, era: 5, capstone: true, requires: ["frontierLabs", "autonomousOps"] },
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
  return RESEARCH_PROJECTS.find((p) => p.id === id)!;
}

/** Item 4.2 — the prerequisite projects for `id` that are NOT yet completed (empty = unlocked). Used to
 *  gate the buy and to show "requires …" on a locked capstone. Pure. */
export function prereqsMissing(completed: readonly ProjectId[], id: ProjectId): ProjectId[] {
  const req = RESEARCH_PROJECTS.find((p) => p.id === id)?.requires;
  if (!req) return [];
  const done = new Set(completed);
  return req.filter((r) => !done.has(r));
}

/** Whether `id` is researchable right now given what's completed: not already done, no fork sibling
 *  chosen, and every prerequisite met. (Era + RP affordability are checked by the caller.) Pure. */
export function projectUnlocked(completed: readonly ProjectId[], id: ProjectId): boolean {
  return !completed.includes(id) && !forkLockedBy(completed, id) && prereqsMissing(completed, id).length === 0;
}

// Item 4.4 — the human name of each doctrine House, for the epilogue clause + UI. Keyed by the fork
// project id the company committed to.
const DOCTRINE_LABEL: Partial<Record<ProjectId, string>> = {
  perfHouse: "a Performance house", effHouse: "an Efficiency house", qualityHouse: "a Reliability house",
  gtmHype: "a Hype-driven brand", gtmDesign: "a Design-led brand", gtmPrestige: "a Prestige brand",
  opsSpeed: "a Speed operation", opsCost: "a Cost operation", opsReach: "a Reach operation",
};

/** Item 4.4 — a short clause naming the doctrines a company committed to (engineering + GTM houses),
 *  for the campaign epilogue. Empty string when no doctrine was chosen. Pure. */
export function doctrineSummary(completed: readonly ProjectId[]): string {
  const chosen = completed.map((id) => DOCTRINE_LABEL[id]).filter(Boolean) as string[];
  if (chosen.length === 0) return "";
  if (chosen.length === 1) return `It was built as ${chosen[0]}.`;
  return `It was built as ${chosen.slice(0, -1).join(", ")} and ${chosen[chosen.length - 1]}.`;
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
