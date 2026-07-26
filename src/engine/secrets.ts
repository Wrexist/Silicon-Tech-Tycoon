// The Vault — CLASSIFIED DOSSIERS: a hidden progression layer the player uncovers by playing in ways
// the rest of the game never asks for. Every other progression track in this game states its terms up
// front (mastery bars, contracts, goals, the roadmap). The Vault deliberately does not: you can see
// that N files exist and how many you've opened, but not what's in them — until the game decides you
// have earned a look.
//
// The reveal ladder is the whole point (three separate hits, not one):
//   0 sealed     — a redacted card. You know it exists and what TIER it is. Nothing else.
//   1 rumored    — a poetic WHISPER appears ("they say a machine once sold itself…"). Still no terms.
//   2 decrypted  — the exact REQUIREMENT + a live progress bar + the named reward. Now you can chase it.
//   3 unearthed  — met. The boon is permanent for the run and the file joins your codex forever.
//
// A file rises to `rumored` on a cheap, natural gate (`rumorAt`) you hit just by playing, and to
// `decrypted` once you are halfway to its real condition — so ordinary play keeps quietly dripping
// reveals. Impatient founders can BUY a stage with cash (see `investigationCost`), which is the
// deliberate "grind/fight for the knowledge" verb: intel is a purchasable resource, the deed is not.
//
// PURE + deterministic + sim-safe by construction:
//  - Everything here is a fold over facts the engine ALREADY tracks (launched[], staff, contracts,
//    awards, holdings, cashHistory…). No RNG, no new counters, no hidden clock.
//  - Every condition requires a LAUNCHED product or another explicit player action, and the state
//    layer only evaluates the Vault once `launched.length > 0`, so the pinned do-nothing 160-week run
//    never opens a file, never writes Vault state, and stays byte-identical.
//  - Persistent rewards fold through `secretBonuses()` into the SAME prestige/design-budget/product-stat
//    seams the moonshot rewards use. Empty found → the all-zero bonus.
import type { GameState } from "../state/gameState.ts";
import { dollars, toDollars, type Money } from "./money.ts";
import { franchiseStem, brandEquity, brandEquityLabel } from "./franchise.ts";
import type { Stats } from "./types.ts";

/** How far along a file is. Monotonic per run except that buying intel can only ever raise it. */
export type SecretStage = 0 | 1 | 2 | 3;
export const STAGE_SEALED = 0 as const;
export const STAGE_RUMORED = 1 as const;
export const STAGE_DECRYPTED = 2 as const;
export const STAGE_UNEARTHED = 3 as const;

/** Difficulty band. Drives the card's colour, the intel price, and roughly how big the boon is. */
export type SecretTier = 1 | 2 | 3 | 4;

/** The classification stamped on the folder. Deliberately distinct language from the reveal STAGES
 *  (sealed / rumored / decrypted) so a card never reads as if its tier were its state. */
export const TIER_NAMES: Record<SecretTier, string> = {
  1: "Restricted",
  2: "Confidential",
  3: "Black File",
  4: "Omega",
};

/** What a still-sealed card says instead of a hint — flavour that escalates with the classification
 *  and says nothing whatsoever about the condition. */
export const TIER_SEALED_COPY: Record<SecretTier, string> = {
  1: "Restricted. Someone filed this and didn't write a summary.",
  2: "Confidential. The index card for this folder is missing.",
  3: "Black file. Even the cover sheet is redacted.",
  4: "Omega. One folder, no copies, no reference number.",
};

/** Fraction of a file's trace you must gather before it self-decrypts (the requirement goes public). */
export const DECRYPT_AT = 0.5;

/** What opening a file grants. Persistent kinds fold through `secretBonuses()`; `legacy` and `title`
 *  are one-time / cosmetic and are deliberately NOT in the aggregation. */
export type SecretRewardKind =
  | "hype"          // + fractional launch hype on every launch
  | "rpMult"        // + fractional weekly-RP income
  | "buildCost"     // fractional build-cost REDUCTION
  | "designCeiling" // + to the design-tier ceiling (structural)
  | "epBudget"      // + EP to every project's design budget
  | "signature"     // a per-product stat flourish (folds into productStats)
  | "legacy"        // a ONE-TIME Legacy Point grant, banked the week the file opens
  | "title";        // cosmetic only — a founder title shown in the Vault

export interface SecretReward {
  kind: SecretRewardKind;
  /** Plain-language one-liner shown on the decrypted card and in the reveal ceremony. */
  label: string;
  hype?: number;
  rpMult?: number;
  buildCostMult?: number; // 0.02 = −2% build cost
  designCeiling?: number;
  epBudget?: number;
  stat?: Partial<Stats>;
  legacyPoints?: number;
  title?: string;
}

/** The read-only facts a dossier predicate may consult. Every one is derived from state the engine
 *  already keeps — the Vault invents no counters of its own. */
export interface SecretFacts {
  week: number;
  era: number;
  productsShipped: number;
  hits: number;
  categoriesShipped: number;
  /** A launch that hit with NO marketing campaign attached. */
  ghostHit: boolean;
  /** A hit whose launch insight named Budget the dominant segment. */
  budgetHit: boolean;
  /** A hit launched ≥ QUIET_GAP weeks after the previous launch (patience, not spam). */
  quietComeback: boolean;
  /** A hit shipped to every region in the catalog on the same product. */
  fiveFlagHit: boolean;
  /** A launch priced within PRICE_EPSILON of perfect that ALSO read ≥85 demand fit. */
  perfectPricing: boolean;
  /** Production runs that sold their entire planned volume. */
  soldOutRuns: number;
  /** Biggest team size all of whose members are at/above the elation mood bar (0 if the team is small). */
  elatedTeam: number;
  contractsCompleted: number;
  completedProjects: number;
  /** Deepest franchise line (entries) that has reached Iconic brand equity. */
  iconicLineDepth: number;
  /** Deepest franchise line by entries, whatever its standing — the progress read for House Style. */
  deepestLineDepth: number;
  osLicensees: number;
  nemesisTrophies: number;
  /** Most awards taken in any single ceremony. */
  bestCeremonySweep: number;
  /** Distinct rivals the player holds shares in. */
  rivalsHeld: number;
  /** Lowest cash (dollars) on record in the rolling history — the near-death low. */
  lowestCash: number;
  /** Current net cash (dollars). */
  cash: number;
  /** Files already opened this run (for the Omega file, which counts its siblings). */
  found: number;
}

export interface Secret {
  id: string;
  /** The name on the folder. Hidden until `rumored`; before that the card shows a redaction block. */
  codename: string;
  tier: SecretTier;
  /** Shown at `rumored`: evocative, never a number. This is the tease that makes people hunt. */
  whisper: string;
  /** Shown at `decrypted`: the exact, honest requirement. No riddles once it's open. */
  requirement: string;
  /** The cheap natural gate that lifts a file to `rumored`. Hit by ordinary play, never by waiting. */
  rumorAt: (f: SecretFacts) => boolean;
  /** The real condition. Latched by the caller — once met, a file stays found. */
  met: (f: SecretFacts) => boolean;
  /** A DISPLAY proxy for "how close am I" — clamped below `traceNeed` until `met`, so it can never
   *  claim completion the condition hasn't earned. Also drives the self-decrypt threshold. */
  trace: (f: SecretFacts) => number;
  traceNeed: number;
  /** Unit label for the progress readout ("launches", "signs", "contracts"…). */
  traceUnit: string;
  reward: SecretReward;
}

/** Weeks of silence before a launch counts as a "quiet" comeback. */
export const QUIET_GAP = 26;
/** How close to a perfect price read still counts as perfect (LaunchInsight.priceFit, 1 = on the money). */
export const PRICE_EPSILON = 0.04;
/** Mood every teammate must hold at once for the night-shift file. */
export const ELATED_MOOD = 88;
/** Team size needed for the night-shift file. */
export const ELATED_TEAM = 6;

// ---------------------------------------------------------------------------------------------
// The catalog. Eighteen files across four tiers. Read the whispers first — they're written to be
// read cold, with no idea what they mean, and to make sense in hindsight.
//
// Balance note: every persistent boon is deliberately SMALL (mastery-scale, not moonshot-scale).
// The complete set is worth roughly +11% hype, +18% RP, −6% build cost, +2 design ceiling and +2 EP
// — earned over a long run of deliberately off-meta play, and never a substitute for the main tracks.
// ---------------------------------------------------------------------------------------------
export const SECRETS: readonly Secret[] = [
  // --- Tier 1 · Whispers — the "wait, that's a thing?" tier. Reachable in a first real run. -----
  {
    id: "ghostSignal",
    codename: "Ghost Signal",
    tier: 1,
    whisper: "They talk about a machine that sold itself. No campaign, no billboards. It just… moved.",
    requirement: "Land a hit with no marketing campaign attached.",
    rumorAt: (f) => f.productsShipped >= 2,
    met: (f) => f.ghostHit,
    trace: (f) => (f.hits > 0 ? 1 : 0) + (f.productsShipped >= 4 ? 1 : 0),
    traceNeed: 2,
    traceUnit: "signs",
    reward: { kind: "hype", label: "Word of mouth: +2% launch hype, permanently", hype: 0.02 },
  },
  {
    id: "streetLevel",
    codename: "Street Level",
    tier: 1,
    whisper: "The critics were bored by it. The street was not. Somebody sold a hit to the people with the least money.",
    requirement: "Land a hit whose biggest buyer segment was Budget.",
    rumorAt: (f) => f.hits >= 1,
    met: (f) => f.budgetHit,
    trace: (f) => Math.min(2, f.hits),
    traceNeed: 2,
    traceUnit: "signs",
    reward: { kind: "buildCost", label: "Lean tooling: −1% build cost, permanently", buildCostMult: 0.01 },
  },
  {
    id: "nightShift",
    codename: "The Night Shift",
    tier: 1,
    whisper: "There was a season where nobody wanted to go home. Nothing was written down about why.",
    requirement: `Hold a team of ${ELATED_TEAM}+ with every single person at ${ELATED_MOOD}+ mood in the same week.`,
    rumorAt: (f) => f.elatedTeam >= 3,
    met: (f) => f.elatedTeam >= ELATED_TEAM,
    trace: (f) => Math.min(ELATED_TEAM, f.elatedTeam),
    traceNeed: ELATED_TEAM,
    traceUnit: "elated staff",
    reward: { kind: "rpMult", label: "A lab that never sleeps: +3% weekly research", rpMult: 0.03 },
  },
  {
    id: "paperTrail",
    codename: "Paper Trail",
    tier: 1,
    whisper: "Somewhere there's a filing cabinet of signed deliveries, and every one of them was met.",
    requirement: "Deliver six contracts from the board.",
    rumorAt: (f) => f.contractsCompleted >= 1,
    met: (f) => f.contractsCompleted >= 6,
    trace: (f) => Math.min(6, f.contractsCompleted),
    traceNeed: 6,
    traceUnit: "contracts",
    reward: { kind: "rpMult", label: "Standing orders: +2% weekly research", rpMult: 0.02 },
  },
  {
    id: "emptyShelves",
    codename: "Empty Shelves",
    tier: 1,
    whisper: "Three times the doors opened and there was nothing left behind them by evening.",
    requirement: "Sell out three production runs completely.",
    rumorAt: (f) => f.productsShipped >= 3,
    met: (f) => f.soldOutRuns >= 3,
    trace: (f) => Math.min(3, f.soldOutRuns),
    traceNeed: 3,
    traceUnit: "sell-outs",
    reward: { kind: "buildCost", label: "Demand-led planning: −1% build cost", buildCostMult: 0.01 },
  },

  // --- Tier 2 · Ciphers — asks you to play against your own habits. ----------------------------
  {
    id: "theQuietYear",
    codename: "The Quiet Year",
    tier: 2,
    whisper: "For half a year the factory was dark, and the industry decided they were finished. They were not finished.",
    requirement: `Land a hit at least ${QUIET_GAP} weeks after your previous launch.`,
    rumorAt: (f) => f.productsShipped >= 3,
    met: (f) => f.quietComeback,
    trace: (f) => (f.productsShipped >= 3 ? 1 : 0) + (f.hits >= 2 ? 1 : 0),
    traceNeed: 2,
    traceUnit: "signs",
    reward: { kind: "hype", label: "Anticipation compounds: +3% launch hype", hype: 0.03 },
  },
  {
    id: "theRightNumber",
    codename: "The Right Number",
    tier: 2,
    whisper: "One price was so exactly right that nobody argued about it. Not the buyers, not the accountants.",
    requirement: "Launch a product the market read as perfectly priced (price fit ~1.00) with 85+ demand fit.",
    rumorAt: (f) => f.productsShipped >= 4,
    met: (f) => f.perfectPricing,
    trace: (f) => Math.min(2, Math.floor(f.productsShipped / 4)),
    traceNeed: 2,
    traceUnit: "signs",
    reward: { kind: "buildCost", label: "Costed to the cent: −2% build cost", buildCostMult: 0.02 },
  },
  {
    id: "fiveFlags",
    codename: "Five Flags",
    tier: 2,
    whisper: "The same box, the same week, on every continent. Logistics people still tell the story wrong.",
    requirement: "Land a hit on a product shipped to all five regions at once.",
    rumorAt: (f) => f.era >= 2,
    met: (f) => f.fiveFlagHit,
    trace: (f) => (f.hits >= 1 ? 1 : 0) + (f.era >= 3 ? 1 : 0),
    traceNeed: 2,
    traceUnit: "signs",
    reward: { kind: "hype", label: "A name in every market: +3% launch hype", hype: 0.03 },
  },
  {
    id: "houseStyle",
    codename: "House Style",
    tier: 2,
    whisper: "You could recognise their work across a room. Five generations of it, and never once a reset.",
    requirement: "Grow a single product line to five entries and Iconic brand equity.",
    rumorAt: (f) => f.productsShipped >= 4,
    met: (f) => f.iconicLineDepth >= 5,
    trace: (f) => Math.min(5, f.deepestLineDepth),
    traceNeed: 5,
    traceUnit: "entries in a line",
    reward: { kind: "signature", label: "A recognisable hand: +1 Design on every product", stat: { design: 1 } },
  },
  {
    id: "borrowedFire",
    codename: "Borrowed Fire",
    tier: 2,
    whisper: "Three competitors shipped hardware running someone else's soul, and paid for the privilege.",
    requirement: "Have three rivals licensing your OS at the same time.",
    rumorAt: (f) => f.osLicensees >= 1,
    met: (f) => f.osLicensees >= 3,
    trace: (f) => Math.min(3, f.osLicensees),
    traceNeed: 3,
    traceUnit: "licensees",
    reward: { kind: "rpMult", label: "Platform gravity: +5% weekly research", rpMult: 0.05 },
  },
  {
    id: "theLongGame",
    codename: "The Long Game",
    tier: 2,
    whisper: "A decade of quiet funding with nothing to show each quarter, and then everything at once.",
    requirement: "Complete twelve research projects in one company.",
    rumorAt: (f) => f.completedProjects >= 3,
    met: (f) => f.completedProjects >= 12,
    trace: (f) => Math.min(12, f.completedProjects),
    traceNeed: 12,
    traceUnit: "projects",
    reward: { kind: "epBudget", label: "Deep bench: +1 EP on every project's design budget", epBudget: 1 },
  },

  // --- Tier 3 · Black Files — long-run, endgame-shaped. These are the real chase. ---------------
  {
    id: "theUndercut",
    codename: "The Undercut",
    tier: 3,
    whisper: "Twice they came for the crown, and twice they went home with less than they arrived with.",
    requirement: "Win two duels against your arch-rival.",
    rumorAt: (f) => f.nemesisTrophies >= 1 || f.hits >= 3,
    met: (f) => f.nemesisTrophies >= 2,
    trace: (f) => Math.min(2, f.nemesisTrophies),
    traceNeed: 2,
    traceUnit: "trophies",
    reward: { kind: "hype", label: "A reputation for winning: +3% launch hype", hype: 0.03 },
  },
  {
    id: "cleanSweep",
    codename: "Clean Sweep",
    tier: 3,
    whisper: "One night, one company, and the presenters stopped bothering to open the envelopes.",
    requirement: "Take three or more awards in a single Silicon Awards ceremony.",
    rumorAt: (f) => f.bestCeremonySweep >= 1,
    met: (f) => f.bestCeremonySweep >= 3,
    trace: (f) => Math.min(3, f.bestCeremonySweep),
    traceNeed: 3,
    traceUnit: "awards in a night",
    reward: { kind: "designCeiling", label: "Design ceiling +1 — every build can push one tier higher", designCeiling: 1 },
  },
  {
    id: "phoenixFile",
    codename: "The Phoenix File",
    tier: 3,
    whisper: "The payroll didn't clear that month. Nine years later they bought the building it happened in.",
    requirement: "Fall under $25k cash, then climb back to $25M.",
    rumorAt: (f) => f.lowestCash < 100_000,
    met: (f) => f.lowestCash < 25_000 && f.cash >= 25_000_000,
    trace: (f) => (f.lowestCash < 25_000 ? 1 : 0) + (f.cash >= 5_000_000 ? 1 : 0),
    traceNeed: 2,
    traceUnit: "signs",
    reward: { kind: "buildCost", label: "Scar tissue: −2% build cost, permanently", buildCostMult: 0.02 },
  },
  {
    id: "theCartographer",
    codename: "The Cartographer",
    tier: 3,
    whisper: "They kept walking into rooms nobody in the company had ever been in, and coming out with a product.",
    requirement: "Ship products in eight different device categories.",
    rumorAt: (f) => f.categoriesShipped >= 3,
    met: (f) => f.categoriesShipped >= 8,
    trace: (f) => Math.min(8, f.categoriesShipped),
    traceNeed: 8,
    traceUnit: "categories",
    reward: { kind: "epBudget", label: "Generalist tooling: +1 EP on every design budget", epBudget: 1 },
  },
  {
    id: "deepWater",
    codename: "Deep Water",
    tier: 3,
    whisper: "Twenty-five machines out of one building. Nobody has counted them correctly since.",
    requirement: "Ship twenty-five products in a single company.",
    rumorAt: (f) => f.productsShipped >= 8,
    met: (f) => f.productsShipped >= 25,
    trace: (f) => Math.min(25, f.productsShipped),
    traceNeed: 25,
    traceUnit: "products",
    reward: { kind: "rpMult", label: "Institutional memory: +8% weekly research", rpMult: 0.08 },
  },
  {
    id: "theInsider",
    codename: "The Insider",
    tier: 3,
    whisper: "Every board in the industry had one of their people at the table. Not one of those seats was announced.",
    requirement: "Hold shares in six different rival companies at once.",
    rumorAt: (f) => f.rivalsHeld >= 2,
    met: (f) => f.rivalsHeld >= 6,
    trace: (f) => Math.min(6, f.rivalsHeld),
    traceNeed: 6,
    traceUnit: "rivals held",
    reward: { kind: "hype", label: "Industry standing: +2% launch hype", hype: 0.02 },
  },

  // --- Tier 4 · Omega — the file about the files. Cannot be bought, only completed. -------------
  {
    id: "theFoundersFile",
    codename: "The Founder's File",
    tier: 4,
    whisper: "There is one more folder. It is thinner than the others, and it has your name on it.",
    requirement: "Open every other dossier in the Vault.",
    rumorAt: (f) => f.found >= 4,
    met: (f) => f.found >= SECRET_COUNT_EXCEPT_OMEGA,
    trace: (f) => Math.min(SECRET_COUNT_EXCEPT_OMEGA, f.found),
    // Must equal SECRET_COUNT_EXCEPT_OMEGA — the const isn't readable from inside its own array
    // literal, so a unit test pins the two together (add a file → update this number).
    traceNeed: 17,
    traceUnit: "files opened",
    reward: {
      kind: "designCeiling",
      label: "Keeper of the Vault: design ceiling +1, and 5 Legacy Points",
      designCeiling: 1,
      legacyPoints: 5,
      title: "Keeper of the Vault",
    },
  },
];

export const SECRET_COUNT = SECRETS.length;
/** Every file except the Omega one — the Omega file's own bar counts these. */
export const SECRET_COUNT_EXCEPT_OMEGA = SECRETS.filter((s) => s.tier < 4).length;
/** The Omega file's id — it can never be bought open, only completed. */
export const OMEGA_SECRET_ID = "theFoundersFile";

export function secretById(id: string): Secret | undefined {
  return SECRETS.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------------------------

/** Every region in the catalog (used by the five-flags file). Kept as a literal count so a future
 *  sixth region doesn't silently retune a shipped dossier. */
const ALL_REGION_COUNT = 5;

/** Derive the read-only fact sheet from a full GameState. Pure; allocates one small object. */
export function deriveSecretFacts(state: GameState): SecretFacts {
  const launched = state.launched ?? [];
  let hits = 0;
  let ghostHit = false;
  let budgetHit = false;
  let quietComeback = false;
  let fiveFlagHit = false;
  let perfectPricing = false;
  let soldOutRuns = 0;
  const categories = new Set<string>();

  // launched[] is NEWEST-FIRST (the launch reducer prepends), so the launch BEFORE entry i sits at
  // i + 1 — that's the pairing the quiet-gap read walks.
  for (let i = 0; i < launched.length; i++) {
    const lp = launched[i];
    if (!lp?.product) continue;
    const hit = lp.verdict === "hit";
    if (hit) hits++;
    categories.add(lp.product.category);
    if (hit && (lp.product.channelId == null || lp.product.channelId === "none")) ghostHit = true;
    if (hit && lp.insight?.dominantSegment === "budget") budgetHit = true;
    if (hit && (lp.product.regions?.length ?? 1) >= ALL_REGION_COUNT) fiveFlagHit = true;
    if (lp.insight && Math.abs(lp.insight.priceFit - 1) <= PRICE_EPSILON && lp.insight.demandFit >= 85) {
      perfectPricing = true;
    }
    const planned = lp.plannedUnits ?? lp.product.plannedUnits ?? 0;
    if (planned > 0 && lp.unitsSold >= planned) soldOutRuns++;
    const prev = launched[i + 1];
    if (hit && prev && lp.launchedWeek - prev.launchedWeek >= QUIET_GAP) quietComeback = true;
  }

  // The biggest team that is ENTIRELY at/above the elation bar — i.e. the headcount if everyone
  // qualifies, otherwise how many do (so the progress bar still climbs while one person is unhappy).
  const staff = state.staff ?? [];
  const elatedCount = staff.filter((p) => (p.mood ?? 0) >= ELATED_MOOD).length;
  const elatedTeam = staff.length > 0 && elatedCount === staff.length ? staff.length : elatedCount;

  // Deepest Iconic line: group the launch history by franchise stem and ask the EXISTING brand-equity
  // model which of those lines has actually reached Iconic. `entries` is the model's own
  // recency-capped count (BALANCE.franchise.maxEntries), which is exactly what the requirement means
  // by "five entries" — a line's sixth-oldest launch no longer props the brand up.
  const stems = new Set<string>();
  for (const lp of launched) {
    const stem = lp?.product?.name ? franchiseStem(lp.product.name) : "";
    if (stem) stems.add(stem);
  }
  let iconicLineDepth = 0;
  let deepestLineDepth = 0;
  for (const stem of stems) {
    const eq = brandEquity(launched, stem);
    if (eq.entries > deepestLineDepth) deepestLineDepth = eq.entries;
    if (eq.entries > iconicLineDepth && brandEquityLabel(eq) === "Iconic") iconicLineDepth = eq.entries;
  }

  const history = state.cashHistory ?? [];
  let lowestCash = toDollars(state.cash);
  for (const point of history) if (point.cash < lowestCash) lowestCash = point.cash;

  const ceremonies = state.awardsHistory ?? [];
  let bestCeremonySweep = 0;
  for (const c of ceremonies) if ((c.playerWins ?? 0) > bestCeremonySweep) bestCeremonySweep = c.playerWins ?? 0;

  const holdings = state.holdings ?? {};
  const rivalsHeld = Object.keys(holdings).filter((id) => (holdings[id] ?? 0) > 0).length;

  return {
    week: state.week,
    era: state.era,
    productsShipped: launched.length,
    hits,
    categoriesShipped: categories.size,
    ghostHit,
    budgetHit,
    quietComeback,
    fiveFlagHit,
    perfectPricing,
    soldOutRuns,
    elatedTeam,
    contractsCompleted: state.contractsCompleted ?? 0,
    completedProjects: (state.completedProjects ?? []).length,
    iconicLineDepth,
    deepestLineDepth,
    osLicensees: (state.osLicensees ?? []).length,
    nemesisTrophies: state.nemesisTrophies ?? 0,
    bestCeremonySweep,
    rivalsHeld,
    lowestCash,
    cash: toDollars(state.cash),
    found: (state.secretsFound ?? []).length,
  };
}

// ---------------------------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------------------------

export interface SecretProgress {
  have: number;
  need: number;
  unit: string;
  /** 0..1 — `have/need`, for the bar. */
  frac: number;
}

/** A file's display progress. CLAMPED: the proxy can never read complete unless the real condition is
 *  met, and a met condition always reads complete — so the bar never lies in either direction. */
export function secretProgress(secret: Secret, facts: SecretFacts): SecretProgress {
  const need = Math.max(1, secret.traceNeed);
  const raw = Math.max(0, Math.floor(secret.trace(facts)));
  const have = secret.met(facts) ? need : Math.min(need - 1, raw);
  return { have, need, unit: secret.traceUnit, frac: have / need };
}

/** The stage a file has reached NATURALLY (before any bought intel). */
export function naturalStage(secret: Secret, facts: SecretFacts, found: readonly string[]): SecretStage {
  if (found.includes(secret.id)) return STAGE_UNEARTHED;
  if (secretProgress(secret, facts).frac >= DECRYPT_AT) return STAGE_DECRYPTED;
  if (secret.rumorAt(facts)) return STAGE_RUMORED;
  return STAGE_SEALED;
}

/** The stage the player actually SEES: the better of what they've earned right now and what the run
 *  has already LATCHED (state.secretStages — raised by past progress or by bought intel).
 *
 *  The latch matters for honesty in both directions. Some traces can fall again (sell a rival's
 *  shares, lose a licensee), and a file that has already shown you its terms must never re-seal
 *  itself — you don't un-learn a thing. And bought intel can never manufacture an unearthing: the
 *  latch is clamped below `unearthed`, which only the real condition grants. */
export function secretStage(
  secret: Secret,
  facts: SecretFacts,
  found: readonly string[],
  latched: Readonly<Record<string, number>> | undefined,
): SecretStage {
  const natural = naturalStage(secret, facts, found);
  if (natural === STAGE_UNEARTHED) return STAGE_UNEARTHED;
  const held = Math.max(0, Math.min(STAGE_DECRYPTED, Math.floor(latched?.[secret.id] ?? 0)));
  return Math.max(natural, held) as SecretStage;
}

/** Every file whose condition is met but that isn't in `found` yet — what the tick latches. */
export function newlyUnearthed(facts: SecretFacts, found: readonly string[]): string[] {
  const have = new Set(found);
  return SECRETS.filter((s) => !have.has(s.id) && s.met(facts)).map((s) => s.id);
}

// ---------------------------------------------------------------------------------------------
// Intel — the purchasable half of the loop
// ---------------------------------------------------------------------------------------------

/** Cash to buy ONE stage of intel on a file of this tier (sealed→rumored, or rumored→decrypted).
 *  Priced to be a real decision early and a rounding error late — this buys knowledge, never the deed.
 *  The Omega file is never purchasable (see `canInvestigate`). */
export function investigationCost(tier: SecretTier, toStage: SecretStage): Money {
  const base = tier === 1 ? 120_000 : tier === 2 ? 400_000 : 1_200_000;
  // Decrypting (learning the exact terms + the reward) costs double what a whisper does.
  return dollars(toStage >= STAGE_DECRYPTED ? base * 2 : base);
}

/** Can this file's next stage be bought right now? Omega is exempt; an unearthed or already-decrypted
 *  file has nothing left to sell. */
export function canInvestigate(secret: Secret, stage: SecretStage): boolean {
  if (secret.id === OMEGA_SECRET_ID) return false;
  return stage < STAGE_DECRYPTED;
}

// ---------------------------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------------------------

export interface SecretBonus {
  designCeiling: number;
  hype: number;
  rpMult: number;
  buildCostMult: number;
  epBudget: number;
  stat: Partial<Stats>;
}

const ZERO_SECRET_BONUS: SecretBonus = {
  designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0, epBudget: 0, stat: {},
};

/** The aggregate persistent bonus from every OPENED file. Empty found → the all-zero bonus, so old
 *  saves and the do-nothing pin (which open nothing) fold to no change. One-time `legacyPoints` and
 *  cosmetic `title` rewards are deliberately excluded — they're banked at the moment of discovery. */
export function secretBonuses(found: readonly string[] | undefined): SecretBonus {
  if (!found || found.length === 0) return ZERO_SECRET_BONUS;
  const out: SecretBonus = { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0, epBudget: 0, stat: {} };
  for (const id of found) {
    const s = secretById(id);
    if (!s) continue;
    const r = s.reward;
    out.designCeiling += r.designCeiling ?? 0;
    out.hype += r.hype ?? 0;
    out.rpMult += r.rpMult ?? 0;
    out.buildCostMult += r.buildCostMult ?? 0;
    out.epBudget += r.epBudget ?? 0;
    if (r.stat) {
      for (const k of Object.keys(r.stat) as (keyof Stats)[]) out.stat[k] = (out.stat[k] ?? 0) + (r.stat[k] ?? 0);
    }
  }
  return out;
}

/** The founder title earned from opened files (the last one wins), or null. Cosmetic only. */
export function secretTitle(found: readonly string[] | undefined): string | null {
  if (!found || found.length === 0) return null;
  let title: string | null = null;
  for (const id of found) {
    const t = secretById(id)?.reward.title;
    if (t) title = t;
  }
  return title;
}

/** Whispers the feed uses when a file stirs. Cosmetic text only — never touches balance. */
export const VAULT_WHISPER_LINES: readonly string[] = [
  "Something moved in the archive. A file you didn't know about has a name now.",
  "An old folder surfaced on someone's desk overnight. Nobody admits to putting it there.",
  "A rumour reached the front office. There's more in the vault than anyone filed.",
  "One of the sealed files is warm to the touch. Somebody has been reading it.",
  "A page turned up in the shredder queue, unshredded, deliberately.",
];

/** Deterministic pick over the whisper lines — DERIVED hash of (seed, week, salt 311), never the sim
 *  RNG. The literal 312 below is `salt + 1`, matching the canonical hash01 recipe (eureka / license
 *  offers / moonshots). Cosmetic feed flavour only — this hash never touches balance. */
export function vaultWhisperLine(seed: number, week: number): string {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(312, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  const r = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  return VAULT_WHISPER_LINES[Math.floor(r * VAULT_WHISPER_LINES.length) % VAULT_WHISPER_LINES.length];
}
