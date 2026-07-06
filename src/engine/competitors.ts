// Competitor AI — rival public companies that launch products (producing competitorStrength the
// market reads) AND trade on the stock market with a live share price. PURE.
//
// Names are ORIGINAL but evoke real-world archetypes (IP rule: no real brand names). Pomelo ≈ the
// premium "fruit" maker, Tristar ≈ the broad "three-stars" conglomerate, Oqular ≈ the search/
// platform giant, NovaPlus ≈ the flagship-killer, Pandacore ≈ the aggressive value manufacturer.
import { BALANCE } from "./balance.ts";
import { unlockedCategories } from "./eras.ts";
import { cents, type Money } from "./money.ts";
import type { Rng } from "./rng.ts";
import type { CategoryId, CompetitorState } from "./types.ts";

interface RivalDef {
  id: string;
  name: string;
  blurb: string;
  reputation: number;
  share: number; // starting share price in dollars
  vol: number; // volatility multiplier (premium = steady, value = swingy)
  /** Outstanding shares — sets the rival's market cap (sharePrice × shares). Calibrated so the
   *  rivals span ~$45M (scrappy) to ~$2.4B (the giant), giving the player a long ladder to climb. */
  shares: number;
  /** Categories this rival launches into far more often + with a strength bonus (their identity). */
  preferredCategories: readonly CategoryId[];
  /** A 1-2 sentence biography (Track A: narrative & voice): surfaced in the Market rival profile so
   *  each rival reads as a character with a thesis, not just a strength number + a stock ticker. */
  bio: string;
  /** B2 — behavioural posture when the player is winning a category (see advanceCompetitors):
   *   • defender    — counter-punches with extra STRENGTH + faster cadence (the old lead behaviour).
   *   • trendChaser — biases its category choice toward the player's hot categories (crowds you).
   *   • undercutter — ships an aggressively CHEAP product there + presses cadence (price war, no strength).
   *   • generalist  — no special reaction (a broad, steady shipper). */
  doctrine: RivalDoctrine;
}

export type RivalDoctrine = "defender" | "trendChaser" | "undercutter" | "generalist";

export const RIVALS: RivalDef[] = [
  { id: "pomelo",    name: "Pomelo",    blurb: "Premium design & a walled-garden ecosystem.", reputation: 72, share: 188, vol: 0.7, shares: 13_000_000, preferredCategories: ["phone", "wearable"],               doctrine: "defender",    bio: "Founded by a designer obsessed with the seam between hardware and soul. Pomelo set the premium standard and guards it ferociously: win a category it owns and a sharper, pricier answer arrives within weeks." },
  { id: "tristar",   name: "Tristar",   blurb: "A broad electronics giant that ships everything.", reputation: 64, share: 96, vol: 0.9, shares: 9_500_000, preferredCategories: ["phone", "tablet", "laptop"],   doctrine: "generalist",  bio: "A sprawling conglomerate that makes everything from chips to dishwashers. Tristar rarely leads on taste, but its scale and supply chain let it flood any category you open." },
  { id: "googol",    name: "Oqular",    blurb: "Search, services and a platform play.",        reputation: 67, share: 142, vol: 1.0, shares: 10_000_000, preferredCategories: ["tablet", "laptop", "experimental"], doctrine: "trendChaser", bio: "A search-and-services giant that treats hardware as a doorway to its platform. Oqular chases whatever is hot, betting that owning your attention beats owning the device." },
  { id: "novaplus",  name: "NovaPlus",  blurb: "Flagship specs at a fraction of the price.",  reputation: 46, share: 34,  vol: 1.3, shares: 3_500_000, preferredCategories: ["phone"],                           doctrine: "undercutter", bio: "Built on one promise: flagship specifications at half the price. NovaPlus wins the spec sheet and dares you to justify your margins." },
  { id: "pandacore", name: "Pandacore", blurb: "Aggressive value and relentless volume.",     reputation: 41, share: 22,  vol: 1.4, shares: 9_000_000, preferredCategories: ["phone", "tablet", "desktop"],       doctrine: "undercutter", bio: "A relentless value manufacturer that wins on sheer volume and razor-thin margins. Pandacore does not want to be loved; it wants to be everywhere, cheaply." },
  { id: "quantyx",   name: "Quantyx",   blurb: "A scrappy challenger betting on the next wave.", reputation: 30, share: 11, vol: 1.6, shares: 4_100_000, preferredCategories: ["experimental", "wearable"],      doctrine: "trendChaser", bio: "A scrappy upstart betting the company on the next wave. Quantyx is small and volatile, but one well-timed bet on an emerging category can vault it overnight." },
  { id: "zenith",    name: "Zenith",    blurb: "Enterprise workstations & pro laptops.",        reputation: 61, share: 92, vol: 0.8, shares: 7_000_000, preferredCategories: ["laptop", "desktop", "monitor"],    doctrine: "defender",    bio: "The quiet giant of the office. Zenith builds the machines that run banks and studios — unglamorous, bulletproof, and defended with long support contracts you can't easily prise loose." },
  { id: "bytewave",  name: "Bytewave",  blurb: "A services empire dabbling in hardware.",        reputation: 55, share: 64, vol: 1.1, shares: 6_000_000, preferredCategories: ["tablet", "laptop", "experimental"], doctrine: "trendChaser", bio: "A cloud-and-subscriptions empire that ships hardware to keep you inside its walls. Bytewave follows the money into whatever category is trending, then bundles it into a plan." },
  { id: "meridian",  name: "Meridian",  blurb: "A steady mainstream generalist.",               reputation: 49, share: 52, vol: 0.95, shares: 6_500_000, preferredCategories: ["phone", "tablet", "laptop"],      doctrine: "generalist",  bio: "The safe default. Meridian never wins a design award or a spec war, but it is on every carrier and every shelf, quietly banking the customers who don't want to think about it." },
  { id: "corsa",     name: "Corsa",     blurb: "Sporty wearables & style-led phones.",          reputation: 52, share: 40, vol: 1.15, shares: 5_000_000, preferredCategories: ["wearable", "phone"],               doctrine: "defender",    bio: "Born in fitness and fashion, Corsa sells devices as accessories. It owns the wrist and the gym, and answers any style-led challenger with a slicker strap and a louder campaign." },
  { id: "voltix",    name: "Voltix",    blurb: "Cut-price volume across the board.",            reputation: 36, share: 16, vol: 1.4, shares: 8_500_000, preferredCategories: ["phone", "tablet", "desktop"],       doctrine: "undercutter", bio: "A high-street volume brand that competes on one axis: price. Voltix floods the low end, accepts thin margins, and dares the premium names to follow it down." },
  { id: "nimbus",    name: "Nimbus",    blurb: "A frontier-tech upstart chasing the new.",       reputation: 33, share: 14, vol: 1.55, shares: 4_500_000, preferredCategories: ["experimental", "wearable"],       doctrine: "trendChaser", bio: "A tiny, well-hyped studio betting everything on what comes after the phone. Nimbus is volatile and often early, but when it calls an emerging category right, it climbs fast." },
];

/** B3 — reserve challengers that rise to refill the field after the player acquires rivals, so the
 *  industry never goes quiet. Not present at game start; they enter via spawnChallenger. */
export const CHALLENGER_POOL: RivalDef[] = [
  { id: "vortex",  name: "Vortex",  blurb: "A venture-backed upstart chasing every hot trend.",   reputation: 38, share: 26, vol: 1.5, shares: 5_000_000, preferredCategories: ["phone", "wearable", "experimental"], doctrine: "trendChaser", bio: "Venture cash and big ambitions. Vortex chases every hot trend with someone else's money, burning bright and fast in whatever category is fashionable this quarter." },
  { id: "lumina",  name: "Lumina",  blurb: "A contract manufacturer turned cut-price brand.",      reputation: 34, share: 18, vol: 1.5, shares: 8_000_000, preferredCategories: ["phone", "tablet", "laptop"],        doctrine: "undercutter", bio: "Once the factory behind other people's phones, Lumina learned the playbook and turned cut-price brand. It knows exactly what a device costs to build, and prices accordingly." },
  { id: "kestrel", name: "Kestrel", blurb: "A steady mid-market generalist with broad reach.",      reputation: 50, share: 58, vol: 1.0, shares: 7_000_000, preferredCategories: ["laptop", "desktop", "monitor"],     doctrine: "generalist",  bio: "A dependable mid-market generalist with broad retail reach. Kestrel never dazzles, but it is always on the shelf, quietly taking the customers who just want something that works." },
  { id: "axion",   name: "Axion",   blurb: "A premium newcomer betting on design and ecosystem.",   reputation: 58, share: 96, vol: 0.8, shares: 6_000_000, preferredCategories: ["phone", "tablet", "wearable"],      doctrine: "defender",    bio: "A premium newcomer betting that design and a tight ecosystem can unseat the incumbents. Axion is young, well-funded, and unafraid to defend the categories it stakes out." },
];

/** Lookup across the starting roster AND the reserve challenger pool (so an entered challenger has a
 *  full identity — market cap, fair price, doctrine, tone — everywhere rivalDef is consulted). */
export function rivalDef(id: string): RivalDef | undefined {
  return RIVALS.find((r) => r.id === id) ?? CHALLENGER_POOL.find((r) => r.id === id);
}

/** Build a fresh CompetitorState for a rival def entering mid-game (B3 new entrant / refill). */
function freshCompetitor(r: RivalDef, week: number, rng: Rng): CompetitorState {
  return {
    id: r.id,
    name: r.name,
    blurb: r.blurb,
    reputation: r.reputation + rng.range(-4, 4),
    strengthByCategory: {},
    nextLaunchWeek: week + 2 + rng.int(BALANCE.competitors.launchEveryWeeks),
    sharePrice: Math.round(r.share * 100 * (0.92 + rng.range(0, 0.16))),
    priceHistory: [r.share],
  };
}

/** B3 — maybe spawn a new challenger to refill a thinned field. Returns null most weeks (gated by
 *  entryChancePerWeek) and when every challenger is already active or has been acquired. The caller
 *  only invokes this when the field is below its starting size, so a normal game never draws here. */
export function spawnChallenger(
  activeIds: readonly string[],
  acquiredIds: readonly string[],
  week: number,
  rng: Rng,
): CompetitorState | null {
  if (rng.next() >= BALANCE.mergers.entryChancePerWeek) return null;
  const taken = new Set<string>([...activeIds, ...acquiredIds]);
  const pool = CHALLENGER_POOL.filter((r) => !taken.has(r.id));
  if (!pool.length) return null;
  return freshCompetitor(pool[rng.int(pool.length)], week, rng);
}

/** A rival's behavioural doctrine (B2). Defaults to generalist for an unknown id. */
export function rivalDoctrine(id: string): RivalDoctrine {
  return rivalDef(id)?.doctrine ?? "generalist";
}

/** Plain-language label + "what it means for you" for each doctrine (Track A: make the rival's
 *  strategy legible, not just a hidden behaviour). Used by the Market rival profile. */
export const DOCTRINE_LABEL: Record<RivalDoctrine, string> = {
  defender: "Defender",
  trendChaser: "Trend-chaser",
  undercutter: "Undercutter",
  generalist: "Generalist",
};
export const DOCTRINE_EXPLAINER: Record<RivalDoctrine, string> = {
  defender: "Counter-punches with stronger, faster launches when you win the categories it owns.",
  trendChaser: "Piles into whatever category is hot, including the ones you've just proven.",
  undercutter: "Fights on price, not specs: ships aggressively cheap to bleed your margins.",
  generalist: "No special reaction: a broad, steady shipper across many categories.",
};

/** A rival's live market capitalization for the industry leaderboard. The cap is anchored to the
 *  rival's fundamental size (starting share price × float) and nudged by its LIVE share price within
 *  a bounded band. Share prices now mean-revert around their fair value (B6), so they can no longer
 *  compound out of reach — the [0.4×, 2.5×] clamp stays as a safety band (a future balance tweak or
 *  a long lucky streak still can't make #1 unreachable). Keeps the giants worth ~$1-6B, so a
 *  dominant player can climb to — and HOLD — the top of the industry through sustained revenue. */
export function rivalMarketCap(c: CompetitorState): Money {
  const def = rivalDef(c.id);
  const shares = def?.shares ?? 5_000_000;
  const baseShare = def?.share ?? 50; // starting share price in dollars
  const ratio = Math.max(0.4, Math.min(2.5, c.sharePrice / 100 / baseShare));
  return cents(Math.round(baseShare * 100 * shares * ratio));
}

export type RivalArcPhase = "ascending" | "peaking" | "declining" | "stable";

/** A feed beat emitted when a rival crosses into a new arc phase (Track B story arcs). */
export interface ArcBeat {
  competitor: string;
  text: string;
  tone: "positive" | "negative" | "accent";
  week: number;
}

/** Weighted pick of the next arc phase from the current one (deterministic: one rng.next() draw). */
function pickNextPhase(from: RivalArcPhase, rng: Rng): RivalArcPhase {
  const weights = BALANCE.competitors.arc.transitions[from] ?? BALANCE.competitors.arc.transitions.stable;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (const [phase, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) return phase as RivalArcPhase;
  }
  return "stable";
}

/** The feed beat for entering a phase (player POV: a rival rising is bad news, faltering is good).
 *  Returns null for "stable" (a quiet phase) so the feed only speaks at the dramatic turns. */
function arcBeatFor(name: string, phase: RivalArcPhase, week: number): ArcBeat | null {
  switch (phase) {
    case "ascending":
      return { competitor: name, week, tone: "negative", text: `${name} is on a tear, analysts are calling it the company to beat.` };
    case "peaking":
      return { competitor: name, week, tone: "negative", text: `${name} is at the height of its powers, its valuation has never been richer.` };
    case "declining":
      return { competitor: name, week, tone: "positive", text: `${name} is faltering, its last launch landed flat and its stock is sliding.` };
    default:
      return null;
  }
}

/** Advance a rival's story arc one week: re-roll its phase when due (or bootstrap a missing one
 *  silently), then drift its reputation toward the phase direction, clamped to a bounded envelope
 *  around the rival's calibrated base so the drift is mean-reverting (the stock market stays
 *  zero-EV long-run). Draws rng ONLY on a transition week (phase pick + next duration). */
function advanceArc(c: CompetitorState, week: number, rng: Rng): { reputation: number; arcPhase: RivalArcPhase; arcUntil: number; beat: ArcBeat | null } {
  const arc = BALANCE.competitors.arc;
  const base = rivalDef(c.id)?.reputation ?? c.reputation;
  const bootstrap = c.arcPhase === undefined;
  let phase: RivalArcPhase = c.arcPhase ?? "stable";
  let until = c.arcUntil ?? 0;
  let beat: ArcBeat | null = null;
  if (bootstrap || week >= until) {
    phase = pickNextPhase(c.arcPhase ?? "stable", rng);
    until = week + arc.phaseWeeksMin + rng.int(arc.phaseWeeksMax - arc.phaseWeeksMin + 1);
    if (!bootstrap) beat = arcBeatFor(c.name, phase, week); // bootstrap roll is silent (no week-1 spam)
  }
  const lo = Math.max(arc.repFloor, base - arc.repBand);
  const hi = Math.min(arc.repCeil, base + arc.repBand);
  const reputation = Math.max(lo, Math.min(hi, c.reputation + (arc.driftPerWeek[phase] ?? 0)));
  return { reputation, arcPhase: phase, arcUntil: until, beat };
}

export interface CompetitorLaunch {
  competitor: string;
  category: CategoryId;
  strength: number;
  week: number;
  /** B2 — set when an `undercutter` rival launches into a category the player is winning: it ships an
   *  aggressively cheap product there. Drives the visible price posture (rivalAI) + the feed wording. */
  contested?: boolean;
}

export function initCompetitors(rng: Rng): CompetitorState[] {
  return RIVALS.map((r) => ({
    id: r.id,
    name: r.name,
    blurb: r.blurb,
    reputation: r.reputation + rng.range(-4, 4),
    strengthByCategory: {},
    nextLaunchWeek: 2 + rng.int(BALANCE.competitors.launchEveryWeeks),
    sharePrice: Math.round(r.share * 100 * (0.92 + rng.range(0, 0.16))),
    priceHistory: [r.share],
  }));
}

/** The fundamental value a rival's share price reverts toward: its calibrated starting price,
 *  shifted by how far its CURRENT reputation sits from its calibrated starting reputation.
 *  Quality is priced into the LEVEL (Pomelo $188 vs Quantyx $11), never into a perpetual weekly
 *  return — that distinction is what keeps the stock market a timing game, not an income printer. */
export function fairSharePrice(c: CompetitorState): number {
  const def = rivalDef(c.id);
  const baseCents = (def?.share ?? 50) * 100;
  const repDelta = (c.reputation - (def?.reputation ?? c.reputation)) / 100;
  return Math.max(50, Math.round(baseCents * (1 + repDelta * BALANCE.stocks.repFairWeight)));
}

/** Evolve a rival's share price one week: mean-reversion toward fair value + a launch pop + noise.
 *  Zero-EV by design (B6): no baseline drift, no reputation momentum. Pops and dips decay back
 *  toward fairSharePrice, so buy-and-hold earns ~the dividend yield and profit comes from timing. */
function evolveShare(c: CompetitorState, launched: boolean, rng: Rng): { sharePrice: number; priceHistory: number[] } {
  const s = BALANCE.stocks;
  const vol = rivalDef(c.id)?.vol ?? 1;
  const fair = fairSharePrice(c);
  // Immunize the gap math against a corrupt persisted price (matches the v7 hardening pattern).
  const price = Number.isFinite(c.sharePrice) && c.sharePrice > 0 ? c.sharePrice : fair;
  const reversion = Math.log(fair / Math.max(50, price)) * s.meanReversion;
  const pop = launched ? s.launchPop * (0.5 + rng.next()) : 0;
  const noise = rng.range(-1, 1) * s.volatility * vol;
  // Clamp the weekly change so a future balance tweak can never drive (1 + change) <= 0
  // and flip a share price negative; -0.95 leaves headroom below the Math.max(50) floor.
  const change = Math.max(-0.95, reversion + pop + noise);
  const sharePrice = Math.max(50, Math.round(price * (1 + change)));
  const priceHistory = [...c.priceHistory, sharePrice / 100];
  if (priceHistory.length > s.historyLength) priceHistory.shift();
  return { sharePrice, priceHistory };
}

/** Advance one week: decay strengths, fire due rival launches (with specialization + per-rival
 *  doctrines), and move every share price.
 *  @param recentPlayerHitCats - categories where the player scored a hit recently. Each rival reacts
 *    per its B2 doctrine: a defender adds strength + cadence there, a trend-chaser biases its category
 *    choice toward those cats, an undercutter ships an aggressively cheap product + presses cadence. */
export function advanceCompetitors(
  comps: readonly CompetitorState[],
  week: number,
  era: number,
  rng: Rng,
  recentPlayerHitCats?: readonly CategoryId[],
): { competitors: CompetitorState[]; launches: CompetitorLaunch[]; arcBeats: ArcBeat[] } {
  const launches: CompetitorLaunch[] = [];
  const arcBeats: ArcBeat[] = [];
  const bal = BALANCE.competitors;
  // Era-scaled durable competition (P3): rivals decay slower AND can reach higher strength in the
  // late eras, so they entrench and genuinely contest a maxed player. Index = era − 1 (clamped).
  const eraIdx = Math.max(0, Math.min(Math.floor(era) - 1, bal.strengthDecayByEra.length - 1));
  const decay = bal.strengthDecayByEra[eraIdx];
  const maxStrength = bal.reactMaxStrengthByEra[eraIdx];
  const cats = unlockedCategories(era);

  const competitors = comps.map((c) => {
    const strengthByCategory: CompetitorState["strengthByCategory"] = {};
    for (const [cat, s] of Object.entries(c.strengthByCategory)) {
      const decayed = (s as number) * decay;
      if (decayed > 1) strengthByCategory[cat as CategoryId] = decayed;
    }

    let nextLaunchWeek = c.nextLaunchWeek;
    let launchedNow = false;
    if (week >= c.nextLaunchWeek && cats.length) {
      const def = rivalDef(c.id);
      const doctrine = def?.doctrine ?? "generalist";
      const hot = recentPlayerHitCats ?? [];

      // Weighted category selection: preferred categories appear preferredCategoryWeight times; a
      // trend-chaser ALSO piles extra weight onto the player's hot categories (it crowds your wins).
      const weightedCats: CategoryId[] = [];
      for (const cat of cats) {
        let w = def && (def.preferredCategories as readonly string[]).includes(cat) ? bal.preferredCategoryWeight : 1;
        if (doctrine === "trendChaser" && hot.includes(cat)) w += bal.doctrineTargetWeight;
        for (let i = 0; i < w; i++) weightedCats.push(cat);
      }
      const cat = weightedCats[rng.int(weightedCats.length)];

      // Strength: base + reputation factor + jitter
      let strength = bal.baseStrength + c.reputation * 0.4 + rng.range(-6, 10);

      // Home-turf bonus: preferred categories are genuinely harder to contest.
      if (def && (def.preferredCategories as readonly string[]).includes(cat)) {
        strength += bal.preferredStrengthBonus;
      }

      const contestingHot = hot.includes(cat);
      // Defender counter-punches with extra STRENGTH + faster cadence (the old lead behaviour, numbers
      // unchanged). Undercutter contests with PRICE not strength: it ships cheap (flagged `contested`)
      // and presses its cadence, but never raises raw strength — so the game stays winnable.
      const isDefending = doctrine === "defender" && contestingHot;
      const isUndercutting = doctrine === "undercutter" && contestingHot;
      if (isDefending) {
        strength = strength + bal.reactStrengthBonus;
      }
      // Durable competition (P3): late eras add a flat strength bump so rivals reach genuine
      // contesting range against a maxed player (the formula otherwise tops out below the cap).
      strength += bal.lateStrengthByEra[eraIdx];
      // The winnability ceiling applies to EVERY launch, not just defenders — structural, so a future
      // baseStrength/preferredStrengthBonus bump can't silently break the documented cap.
      strength = Math.min(maxStrength, strength);

      strengthByCategory[cat] = Math.max(strengthByCategory[cat] ?? 0, strength);
      launches.push({ competitor: c.name, category: cat, strength: Math.round(strength), week, contested: isUndercutting });
      launchedNow = true;

      // Schedule next launch; the defender + undercutter press their cadence when contesting you.
      const baseInterval = bal.launchEveryWeeks + rng.int(bal.launchJitter);
      const cadenceCut = isDefending ? bal.reactCadenceCut : isUndercutting ? bal.undercutCadenceCut : 0;
      nextLaunchWeek = week + Math.max(1, baseInterval - cadenceCut);
    }

    // Story arc (Track B): re-roll the rival's phase when due + drift its reputation. Drawn AFTER the
    // launch block (so a launch uses the week's opening reputation) and BEFORE evolveShare (so a rising
    // rival's stock pops via its lifted fair value). The drifted reputation carries into next week.
    const { reputation, arcPhase, arcUntil, beat } = advanceArc(c, week, rng);
    if (beat) arcBeats.push(beat);
    const evolved = { ...c, reputation };
    const { sharePrice, priceHistory } = evolveShare(evolved, launchedNow, rng);
    return { ...c, reputation, arcPhase, arcUntil, strengthByCategory, nextLaunchWeek, sharePrice, priceHistory };
  });

  return { competitors, launches, arcBeats };
}

/** Every rival's current strength in a category (only those actively shipping there). When the
 *  player licenses their OS to a rival, that licensee gets a bounded strength uplift here (the
 *  trade-off for the licensing fee) — pass `opts` from the platform layer; omit for plain reads. */
export function rivalStrengthsFor(
  comps: readonly CompetitorState[],
  category: CategoryId,
  opts?: { licenseeIds?: readonly string[]; uplift?: number },
): number[] {
  const licensees = opts?.licenseeIds;
  const up = opts?.uplift ?? 0;
  const out: number[] = [];
  for (const c of comps) {
    // Use the same "rival is present" threshold (>0) for a rival's category presence so the
    // planner and the score's competition term agree on which rivals are active.
    const s = c.strengthByCategory[category];
    if (s && s > 0) out.push(licensees && up > 0 && licensees.includes(c.id) ? s + up : s);
  }
  return out;
}
