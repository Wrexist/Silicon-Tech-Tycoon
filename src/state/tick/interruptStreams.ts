// The opportunistic interrupt streams, lifted out of `advanceOneWeek`.
//
// `advanceOneWeek` is ~1,300 lines running some thirty systems in sequence, and this family is the
// part that grows every time a feature lands: each new "alive" system appends another anonymous
// `{ … }` block to the middle of the function. Nothing declares that these blocks are the same KIND
// of thing, that they run in a fixed order, or what a new one is allowed to touch — so the only way
// to add one correctly was to read the neighbours and copy their shape, which is how the per-overlay
// yield lists drifted apart before `design/interruptPriority.ts` unified them.
//
// A stream is now a named entry in an ordered list with one signature. The order is the order they
// ran inline (preserved exactly — these share one weekly budget, so which one asks first is
// behaviour, not style), and the context object is the complete set of things a stream may read.
//
// Dependencies flow one way: this module imports from `engine/*` only. `noPendingInterrupt` and
// `feedItem` are INJECTED through the context rather than imported, because both live in
// gameState.ts and importing them here would close a cycle — and `feedItem` closes over a
// module-level id counter that must stay single-instance.
import { BALANCE } from "../../engine/balance.ts";
import { makeRng } from "../../engine/rng.ts";
import { pickPoachTarget } from "../../engine/poaching.ts";
import { salaryFor } from "../../engine/economy.ts";
import { scale } from "../../engine/money.ts";
import { eurekaDue, generateEureka } from "../../engine/eureka.ts";
import { communityAskDue, generateCommunityAsk, ASK_INFO } from "../../engine/community.ts";
import { staffMomentDue, pickGrowthTarget, generateStaffMoment } from "../../engine/staffMoment.ts";
import { staffEventDue, pickLifeEventTarget, generateStaffEvent } from "../../engine/staffEvent.ts";
import type { FeedItem, FeedTone, GameState } from "../gameState.ts";

/** Everything a stream is allowed to read. Anything not here is deliberately out of reach: a stream
 *  decides whether to raise ONE card from last week's state and this week's budget, nothing more. */
export interface InterruptCtx {
  /** Last week's state — the source for every `lastXWeek` cooldown and for the seed. */
  prev: GameState;
  week: number;
  /** A catch-up tick replaying missed time: never raise a card the player wasn't there to see. */
  offline: boolean;
  bankrupt: boolean;
  /** At least `BALANCE.interrupts.minGapWeeks` since the last card — the shared budget. */
  interruptQuiet: boolean;
  /** `noPendingInterrupt` — is the screen free right now? Injected to keep the import acyclic. */
  screenFree: (b: GameState) => boolean;
  /** `feedItem` — injected because it closes over gameState's module-level id counter. */
  feed: (week: number, text: string, tone: FeedTone) => FeedItem;
}

/** A stream mutates the in-progress week (`base`) if and only if it fires. Returns nothing: whether
 *  it fired is visible in `base.pendingX`, which is what every consumer already reads. */
export type InterruptStream = (base: GameState, ctx: InterruptCtx) => void;

/** Rival poaching (Track C): a rival on the rise occasionally tries to hire away one of your best —
 *  surfaced as a counter-offer DECISION, not a silent stat drop. A DERIVED rng keeps the main sim
 *  stream byte-identical, so the harness + determinism pin are unaffected. One decision at a time:
 *  only when nothing else is pending, online, solvent, and the team can spare the attention. */
const poaching: InterruptStream = (base, { prev, week, offline, bankrupt, feed }) => {
  // NOTE: poaching predates the shared budget and deliberately does not consult it — it gates on its
  // own pendingPoach/pendingChoice pair and never stamps lastInterruptWeek. Preserved exactly.
  if (offline || bankrupt || base.pendingPoach || base.pendingChoice) return;
  if (base.staff.length < BALANCE.poaching.minTeam) return;
  const prng = makeRng(((prev.rngState ?? prev.seed) >>> 0) ^ Math.imul(week + 1, 0x2545f491));
  if (prng.next() >= BALANCE.poaching.chancePerWeek) return;
  const target = pickPoachTarget(base.staff, base.competitors, week, prng);
  if (!target) return;
  const retainCost = scale(salaryFor(target.staff.role, target.staff.skill), BALANCE.poaching.retainWeeksSalary);
  base.pendingPoach = {
    staffId: target.staff.id, staffName: target.staff.name,
    rivalId: target.rival.id, rivalName: target.rival.name, retainCost, week,
  };
  base.feed.push(feed(week, `${target.rival.name} is trying to poach ${target.staff.name}, one of your best. Match their offer or let them walk.`, "negative"));
};

/** Eureka breakthroughs (engine/eureka.ts) — an active, funded lab occasionally has a flash of insight
 *  (a bank-or-chase bet). Derived-hash cadence (never the sim rng) + a player-CLAIMED payoff, gated on
 *  real researchers + era + cooldown, and it yields to any other pending interrupt. The solo pinned
 *  sim assigns no researchers, so it never fires or resolves one → byte-identical. */
const eureka: InterruptStream = (base, ctx) => {
  const eu = BALANCE.research.eureka;
  const { prev, week } = ctx;
  if (!open(base, ctx)) return;
  if (base.era < eu.minEra) return;
  if (base.staff.filter((s) => s.assignment === "rnd").length < eu.minRnDStaff) return;
  if (week - (prev.lastEurekaWeek ?? -999) < eu.cooldownWeeks) return;
  if (!eurekaDue(prev.seed, week)) return;
  const moment = generateEureka(prev.seed, week, base.era);
  base.pendingEureka = moment;
  base.lastEurekaWeek = week;
  base.lastInterruptWeek = week;
  base.feed.push(ctx.feed(week, `Your lab had a breakthrough in the ${moment.componentKind} line. Bank it, or chase the prototype?`, "accent"));
};

/** Community ASK: once you have a fanbase (launched ≥ 1), the community periodically asks for
 *  something — answer it (resolveCommunityAsk) to grow + delight the base, or pass. Derived-hash
 *  cadence + cooldown + a fresh-launch cooloff; yields to any other pending interrupt. The pinned
 *  solo sim never launches, so it never raises one → byte-identical. */
const communityAsk: InterruptStream = (base, ctx) => {
  const ca = BALANCE.fans.community.asks;
  const { prev, week } = ctx;
  if (!open(base, ctx)) return;
  if (prev.launched.length < 1) return;
  const lastLaunchWeek = prev.launched.reduce((m, lp) => Math.max(m, lp.launchedWeek), -Infinity);
  if (week - (prev.lastCommunityAskWeek ?? -999) < ca.cooldownWeeks) return;
  if (week - lastLaunchWeek < ca.minWeeksSinceLaunch) return;
  if (!communityAskDue(prev.seed, week)) return;
  const ask = generateCommunityAsk(prev.seed, week, base.fans);
  base.pendingCommunityAsk = ask;
  base.lastCommunityAskWeek = week;
  base.lastInterruptWeek = week;
  base.feed.push(ctx.feed(week, `The community is asking: ${ASK_INFO[ask.kind].title.toLowerCase()}. Answer the call, or let it pass?`, "accent"));
};

/** Staff GROWTH moment: a senior, tenured staffer occasionally earns a permanent character upgrade
 *  the player picks (resolveStaffMoment). Derived-hash cadence + cooldown; yields to any other pending
 *  interrupt and respects the global budget. Gated on era + a real team with an eligible non-founder,
 *  so the pinned solo sim (founder only) never raises one → byte-identical. */
const staffGrowth: InterruptStream = (base, ctx) => {
  const g = BALANCE.staff.growth;
  const { prev, week } = ctx;
  if (!open(base, ctx)) return;
  if (base.era < g.minEra || base.staff.length < 2) return;
  if (week - (prev.lastStaffMomentWeek ?? -999) < g.cooldownWeeks) return;
  if (!staffMomentDue(prev.seed, week)) return;
  const target = pickGrowthTarget(base.staff, week);
  if (!target) return;
  const moment = generateStaffMoment(target, prev.seed, week);
  if (moment.options.length === 0) return;
  base.pendingStaffMoment = moment;
  base.lastStaffMomentWeek = week;
  base.lastInterruptWeek = week;
  base.feed.push(ctx.feed(week, `${target.name} has grown into a real force on the team — there's a way to develop them further.`, "accent"));
};

/** Staff LIFE event (item 2.2): a named teammate hits a personal turning point (burnout, an outside
 *  offer, a milestone) and the player answers (resolveStaffEvent). Same guardrails as the growth
 *  moment — derived-hash cadence + cooldown, yields to every other interrupt, gated on an established
 *  team past the garage era, so the founder-only pinned sim never raises one → byte-identical. */
const staffLifeEvent: InterruptStream = (base, ctx) => {
  const le = BALANCE.staff.lifeEvents;
  const { prev, week } = ctx;
  if (!open(base, ctx)) return;
  if (base.era < le.minEra || base.staff.length < 2) return;
  if (week - (prev.lastStaffEventWeek ?? -999) < le.cooldownWeeks) return;
  if (!staffEventDue(prev.seed, week)) return;
  const target = pickLifeEventTarget(base.staff, week);
  if (!target) return;
  base.pendingStaffEvent = generateStaffEvent(target, prev.seed, week);
  base.lastStaffEventWeek = week;
  base.lastInterruptWeek = week;
};

/** The four preconditions every budgeted stream shares: live play, solvent, a quiet week, and a free
 *  screen. Written once here instead of re-typed per block, which is how they used to drift. */
function open(base: GameState, ctx: InterruptCtx): boolean {
  return !ctx.offline && !ctx.bankrupt && ctx.interruptQuiet && ctx.screenFree(base);
}

/** The streams, in the order they ran inside `advanceOneWeek`. They share one weekly budget, so the
 *  order decides who gets it — this list is behaviour, not presentation. (Presentation order, i.e.
 *  which card shows when two coexist, is `design/interruptPriority.ts`.) */
export const INTERRUPT_STREAMS: readonly { readonly key: string; readonly run: InterruptStream }[] = [
  { key: "poaching", run: poaching },
  { key: "eureka", run: eureka },
  { key: "communityAsk", run: communityAsk },
  { key: "staffGrowth", run: staffGrowth },
  { key: "staffLifeEvent", run: staffLifeEvent },
];

/** Run every stream in order against the week in progress. */
export function runInterruptStreams(base: GameState, ctx: InterruptCtx): void {
  for (const s of INTERRUPT_STREAMS) s.run(base, ctx);
}
