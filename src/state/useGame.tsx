// React store: composes gameState reducers, owns the sim tick, persists. The ONLY
// bridge between the pure engine/state layer and the UI. Views never touch the engine directly.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { BALANCE } from "../engine/balance.ts";
import { dollars, format, toDollars, type Money } from "../engine/money.ts";
import type { NegotiationOutcome } from "../engine/licenseOffers.ts";
import type { ComponentKind, FactoryId, Product, RecruitTier, RegionId, StaffRole, SupplierId } from "../engine/types.ts";
import type { ContractTerm } from "../engine/suppliers.ts";
import {
  advanceEraAction,
  chooseMandate as applyMandateChoice,
  advanceOneWeek,
  assignStaff,
  skipInterrupt,
  evaluateAndUnlock,
  evaluateObjectives,
  startResearchProject,
  startResearchTier,
  cancelResearch,
  cancelQueuedResearch,
  hostKeynote,
  announceKeynote,
  resolveStrike,
  collectAwards,
  dismissRivalry,
  dismissNemesisTrophy,
  resolveEureka,
  type EurekaResult,
  resolveCommunityAsk,
  type CommunityAskResult,
  resolveStaffMoment,
  type StaffMomentResult,
  resolveStaffEvent,
  type StaffEventResult,
  resolvePostLaunch,
  type PostLaunchResult,
  resolveRegionalEvent,
  type RegionalEventResult,
  buybackShares,
  resolveEarnings,
  type BuybackResult,
  type EarningsAckResult,
  acceptSideOrder,
  claimContract,
  attemptMoonshot,
  investigateSecret,
  markVaultSeen,
  dismissSecretReveal,
  fundMegaproject,
  buyLegacyPerk,
  buyFrontierTier,
  declineSideOrder,
  cancelSideOrder,
  REV_MILESTONES,
  buyShares,
  acquireRival,
  boardNudge,
  canBoardNudge,
  buyUpgrade,
  unlockRegion,
  acquireFactory,
  negotiateContract,
  cutProductPrice,
  marketingPush,
  investBrandAwareness,
  restockProduct,
  setReorderRate,
  harvestProduct,
  rushBuild,
  buyFloorMachine,
  buyFloorBelt,
  paintBeltRun,
  buyFactoryProp,
  buyFloorExpansion,
  upgradeFloorMachine,
  moveFloorMachine,
  moveFactoryProp,
  autoConnectLine,
  clearFloorCell,
  saveFactoryLayout,
  applyFactoryLayout,
  deleteFactoryLayout,
  giveRaise,
  resolveChoice,
  resolvePoach,
  takeLoan,
  repayLoan,
  boostMorale,
  type MoraleKind,
  clearCandidates,
  duplicateFurniture,
  fireStaff,
  goPublic,
  hireCandidate,
  hireStaff,
  startRecruitment,
  launchReady,
  listCompany,
  applyLayoutSnapshot,
  applyFactorySnapshot,
  moveFurniture,
  newGame,
  placeFurniture,
  removeFurniture,
  unlockLens,
  unlockFinish,
  resetFurniture,
  rotateFurniture,
  sellOwnStake,
  sellShares,
  setAutomation,
  hireSpecialist,
  setCompanyName,
  setSandbox,
  setTeamFocus,
  setFloorStyle,
  setFactoryDecor,
  setLayout,
  setWallStyle,
  startBuild,
  trainStaff,
  restStaff,
  upgradeFacility,
  seedFeedSeq,
  scenarioResultFor,
  newScenarioGame,
  newChallengeGame,
  withChallengeScore,
  withScenarioRunStars,
  setOsName,
  unlockPlatform,
  foundPlatform,
  releaseOsVersion,
  shipSecurityPatch,
  licenseOsToRival,
  revokeOsLicense,
  signLicenseOffer,
  declineLicenseOffer,
  negotiateLicenseOffer,
  installOsFeature,
  setOsPhilosophy,
  ipoValuation,
  industryRank,
  type GameState,
} from "./gameState.ts";
import { getLegacy, setLegacy } from "./legacy.ts";
import { recordStars, getScenarioStars, mergeScenarioStars } from "./scenarioProgress.ts";
import { recordChallengeBest, challengeKey, getChallengeBests, mergeChallengeBests, bestScore, getChallengeAttempts, hasAttemptedChallenge, recordChallengeAttempt, mergeChallengeAttempts } from "./challengeProgress.ts";
import { addMuseumEntry, getMuseum, mergeMuseum, uniqueMuseumKey } from "./museum.ts";
import { recordFounder, getFounderRecord, mergeFounderRecord } from "./founderLegend.ts";
import { getProfileAchievements, mergeProfileAchievements } from "./achievementsProfile.ts";
import { recordSeasonCompletion, getSeasons, mergeSeasons, seasonLabel } from "./seasons.ts";
import { scenarioById, canEarnStars, scenarioUnlocked, scenarioUnlockStars, SCENARIOS } from "../engine/scenarios.ts";
import type { MasteryInput } from "../engine/achievements.ts";
import { dateKeyOf, formatScore, type ChallengeKind } from "../engine/challenges.ts";
import type { Assignment } from "../engine/types.ts";
import type { ProjectId } from "../engine/research.ts";
import type { StrikeResponse } from "./gameState.ts";
import type { UpgradeId } from "../engine/upgrades.ts";
import type { ChannelId } from "../engine/marketing.ts";
import type { FrontierLaneId } from "../engine/frontier.ts";
import type { FurnitureId, PlacedItem, Rot } from "../engine/furniture.ts";
import { clearSave, exportSaveString, importSaveString, importProfileFromString, loadResult, save, stashHomeSave, readHomeSave, hasHomeSave, clearHomeSave } from "./persistence.ts";
import { captureIfDue, clearSnapshots, restoreSnapshot } from "./timeMachine.ts";
import { getSettings, setSettings } from "./settings.ts";
import type { InterruptPace } from "./gameState.ts";
import { withValidatedSandbox } from "./entitlements.ts";
import { createTabGuard } from "./tabGuard.ts";
import { achievementById } from "../engine/achievements.ts";
import { objectiveById } from "../engine/objectives.ts";
import { achievementIcon } from "../design/achievementIcons.tsx";
import { CircleCheck, Cpu, FileSearch, FlaskConical, Landmark, Rocket, Sparkles } from "lucide-react";
import { showToast } from "../design/toast.tsx";
import { emitSpend, emitRpSpend } from "../design/spendFx.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { sfx } from "../design/sound.ts";
import { haptic } from "../design/haptics.ts";
import { projectById } from "../engine/research.ts";
import { moonshotById } from "../engine/moonshots.ts";
import { secretById, STAGE_DECRYPTED } from "../engine/secrets.ts";
import { mergeCodex } from "./secretsProfile.ts";
import { EP_BUDGET_RAISES } from "../engine/designBudget.ts";
import { createElement } from "react";

/** Seed the player's persisted Calm Mode preference into a game state that doesn't carry one yet
 *  (a fresh company, or a save written before Calm Mode existed). An explicit saved choice is kept.
 *  The pure engine's newGame leaves interruptPace undefined (pin-safe); this UI seam applies the pref. */
function withInterruptPace(s: GameState): GameState {
  return s.interruptPace ? s : { ...s, interruptPace: getSettings().interruptPace };
}

/** Fold the current run into the lifetime Founder Legend record (a profile-store side-effect, entirely
 *  outside the sim). Maxima are idempotent, so calling this at both IPO and prestige never double-counts
 *  the same peaks; the prestige/ipo booleans are the only true increments. */
function recordFounderFrom(state: GameState, opts: { prestige?: boolean; ipo?: boolean }): void {
  const hits = state.launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
  recordFounder({
    prestige: opts.prestige,
    ipo: opts.ipo,
    hitsInRun: hits,
    valuationDollars: toDollars(ipoValuation(state)),
    rank: industryRank(state),
    ascension: state.ascensionLevel, // best Heat cleared (recorded at IPO / prestige)
  });
}

function fmtMilestone(d: number): string {
  if (d >= 1_000_000_000) return `$${(d / 1_000_000_000).toFixed(1)}B`;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `$${Math.round(d / 1_000)}k`;
  return format(dollars(d));
}

const FAN_TOAST_THRESHOLDS = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];

function fmtFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/** Fire a celebratory toast when the fan count crosses a milestone. Only the HIGHEST threshold
 *  crossed this tick is announced â€” a fast-forward that vaults several at once is one line, not a
 *  stack â€” and it's low priority, so it yields to anything the player actually asked for. */
function withFanToasts(prev: GameState, next: GameState): void {
  const crossed = FAN_TOAST_THRESHOLDS.filter((m) => prev.fans < m && next.fans >= m);
  const top = crossed.at(-1);
  if (top == null) return;
  try {
    showToast(`${fmtFans(top)} fans, your brand is growing!`, { tone: "positive", priority: "low" });
  } catch { /* toast host not mounted */ }
}

/** Fire a toast when staff gain a skill level during the live tick â€” coalesced, so a week that levels
 *  several people (mentors, fast-forward) is a single line, not a stack of toasts. */
function withStaffLevelToasts(prev: GameState, next: GameState): void {
  const leveled = next.staff.filter((ns) => {
    const ps = prev.staff.find((s) => s.id === ns.id);
    return ps && ns.skill > ps.skill;
  });
  if (leveled.length === 0) return;
  const msg = leveled.length === 1
    ? `${leveled[0].name} reached Skill ${leveled[0].skill}`
    : `${leveled.length} teammates leveled up`;
  try {
    showToast(msg, { tone: "positive" });
  } catch { /* toast host not mounted */ }
}

/** Fire a summary toast when a product finishes its sales run this tick. Coalesced like the staff
 *  levels above: a week that retires several products at once (common on fast-forward, where whole
 *  sell windows close between frames) is ONE line naming the biggest earner, not a stack of three. */
function withProductFinishToasts(prev: GameState, next: GameState): void {
  const finished = next.launched.filter((nlp) => {
    if (nlp.weeksElapsed < nlp.weeklyUnits.length) return false; // still selling
    const plp = prev.launched.find((lp) => lp.product.id === nlp.product.id);
    return !!plp && plp.weeksElapsed < plp.weeklyUnits.length; // was selling last tick
  });
  if (finished.length === 0) return;
  // Lead with the run that earned the most â€” it's the one the player cares about â€” and let the tone
  // follow ITS verdict, so a single flop retiring alongside a hit doesn't read as bad news.
  const lead = finished.reduce((top, lp) => (lp.revenueToDate > top.revenueToDate ? lp : top));
  const v = lead.verdict ?? "steady";
  const tone = v === "hit" || v === "solid" ? "positive" : v === "flop" ? "negative" : "neutral";
  const rest = finished.length - 1;
  try {
    showToast(
      `${lead.product.name} finished its run, ${lead.unitsSold.toLocaleString()} units Â· ${format(lead.revenueToDate)}${rest > 0 ? ` (+${rest} more)` : ""}`,
      { tone },
    );
  } catch { /* toast host not mounted */ }
}

/** Celebrate when the lab FINISHES a timed research this tick. Completion happens inside the pure tick
 *  (activeResearch set â†’ null), so the FX has to come from the diff. Only fires on tick advances â€” a
 *  manual cancel goes through its own callback and never reaches this. */
function withResearchCompleteFx(prev: GameState, next: GameState): void {
  const done = prev.activeResearch && !next.activeResearch ? prev.activeResearch : null;
  // Design Budget (feature #1) â€” a completed EP-raise project lifts the per-project budget. Diff
  // completedProjects so it only counts the tick it lands, and only for a fresh run (the flag is what
  // makes the budget bind at all).
  let raise = 0;
  if (next.designBudgetEnabled && next.completedProjects.length > prev.completedProjects.length) {
    const prevSet = new Set(prev.completedProjects);
    for (const id of next.completedProjects) {
      if (prevSet.has(id)) continue;
      raise += EP_BUDGET_RAISES.find((r) => r.project === id)?.ep ?? 0;
    }
  }
  // The budget raise IS the completion's reward, so when both land on the same tick they're one line â€”
  // two toasts for one event was the clearest case of the app talking over itself.
  if (done) {
    try {
      emitCelebrate();
      sfx("rp");
      showToast(
        raise > 0 ? `Research complete: ${done.name} Â· design budget +${raise} EP` : `Research complete: ${done.name}`,
        { tone: "positive", glyph: <FlaskConical size={15} /> },
      );
    } catch { /* fx host not mounted */ }
  } else if (raise > 0) {
    try { showToast(`Design budget +${raise} EP`, { tone: "neutral", glyph: <Cpu size={15} /> }); } catch { /* toast host not mounted */ }
  }
}

/** Fire a celebratory toast for the revenue milestone crossed between prev and next. Same rule as the
 *  fan milestones: only the HIGHEST threshold crossed this tick, and at low priority â€” these fire on
 *  the sim's schedule, not the player's, so they must never displace an answer the player is reading. */
function withRevToasts(prev: GameState, next: GameState): void {
  const prevD = toDollars(prev.cumulativeRevenue);
  const nextD = toDollars(next.cumulativeRevenue);
  const top = REV_MILESTONES.filter((m) => prevD < m && nextD >= m).at(-1);
  if (top == null) return;
  try {
    showToast(`Revenue milestone, ${fmtMilestone(top)} earned lifetime!`, { tone: "positive", priority: "low" });
  } catch { /* toast host not mounted */ }
}

/** Announce newly-unlocked achievements. Two polish rules (Phase 1, item 5):
 *  - Let the triggering action's own toast (e.g. the launch verdict) land FIRST â€” achievements
 *    are the secondary beat â€” by deferring this slightly.
 *  - Collapse a burst of simultaneous unlocks into ONE toast, so a single action (like a first
 *    launch that trips several milestones at once) can't bury the screen under a stack. */
function announceAchievements(unlocked: readonly string[]): void {
  const earned = unlocked
    .map((id) => achievementById(id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  if (earned.length === 0) return;
  const fire = () => {
    try {
      // A milestone deserves more than silent text â€” the full mastery fanfare.
      sfx("mastery");
      haptic.success();
      if (earned.length === 1) {
        const a = earned[0];
        showToast(`Achievement unlocked, ${a.title}`, {
          tone: "positive",
          glyph: createElement(achievementIcon(a.icon), { size: 15 }),
        });
      } else {
        const names = earned.slice(0, 2).map((a) => a.title).join(" Â· ");
        const extra = earned.length > 2 ? ` +${earned.length - 2} more` : "";
        showToast(`${earned.length} milestones unlocked, ${names}${extra}`, {
          tone: "positive",
          glyph: createElement(achievementIcon("Trophy"), { size: 15 }),
        });
      }
    } catch {
      /* toast host not mounted (e.g. tests) */
    }
  };
  setTimeout(fire, 600);
}

/** Announce newly-completed "Next Move" objectives â€” the soft "goal done, here's the next one"
 *  beat. Same two rules as achievements: defer so the triggering action's toast lands first, and
 *  collapse a burst into one toast. A gentle confirm cue (not the full upgrade fanfare). */
function announceObjectives(completed: readonly string[]): void {
  const done = completed
    .map((id) => objectiveById(id))
    .filter((o): o is NonNullable<typeof o> => !!o);
  if (done.length === 0) return;
  sfx("confirm");
  setTimeout(() => {
    try {
      const label = done.length === 1
        ? `Goal complete, ${done[0].label}`
        : `${done.length} goals complete, ${done[0].label}`;
      showToast(label, { tone: "positive", glyph: createElement(CircleCheck, { size: 15 }) });
    } catch {
      /* toast host not mounted (e.g. tests) */
    }
  }, 700);
}

/**
 * Fold achievement evaluation into a state transition during LIVE play. Marks newly-satisfied
 * milestones unlocked AND fires one celebratory toast per new unlock. Only ever called from live
 * actions with a PRECOMPUTED state value â€” never from inside a setState updater (React invokes
 * updaters more than once under StrictMode, which would double-fire the toasts; the tick gates
 * its announcements per week instead) â€” and never the boot path, which merges the loaded run's
 * unlocks into the profile SILENTLY so a returning player is never spammed with a backlog of
 * celebrations.
 */
/** Cross-run mastery counts for the achievement evaluator, read from the profile stores (which the
 *  pure engine can't reach). Cheap â€” a couple of small JSON reads; called only on the once-per-week
 *  announce path + the value-call unlock paths, never per render. */
function readMasteryInput(): MasteryInput {
  const stars = getScenarioStars();
  const ids = SCENARIOS.map((s) => s.id);
  return {
    totalScenarios: ids.length,
    scenariosWon: ids.filter((id) => (stars[id] ?? 0) >= 1).length,
    scenariosThreeStarred: ids.filter((id) => (stars[id] ?? 0) >= 3).length,
    challengesCompleted: Object.keys(getChallengeBests()).length,
  };
}

function withLiveAchievements(next: GameState): GameState {
  const { state: out, unlocked } = evaluateAndUnlock(next, readMasteryInput());
  announceAchievements(unlocked);
  mergeProfileAchievements(unlocked); // accumulate into the lifetime (cross-company) set
  return out;
}

/** Record any new scenario star earned on this state into the profile store, and celebrate a new
 *  best with one toast. Like announceAchievements, this is called only from the once-per-week tick
 *  gate (recordStars is idempotent â€” it writes only on improvement â€” so a StrictMode double-invoke
 *  can't double-celebrate or double-write). No-op for freeform runs. */
function announceScenarioStars(state: GameState): void {
  if (!state.activeScenario) return;
  // Deadline scenarios are a hard cutoff: stars can only be EARNED on or before the deadline week,
  // so a player can't blow the deadline and then grind the goal out for late credit.
  const scn = scenarioById(state.activeScenario);
  if (scn && !canEarnStars(scn, state.week)) return;
  const res = scenarioResultFor(state);
  if (!res || res.stars <= 0) return;
  const { improved, best } = recordStars(state.activeScenario, res.stars);
  if (!improved) return;
  sfx("star");
  const name = scenarioById(state.activeScenario)?.name ?? "Scenario";
  setTimeout(() => {
    try {
      showToast(`${best}â˜… earned, ${name}`, {
        tone: "positive",
        glyph: createElement(achievementIcon("Star"), { size: 15 }),
      });
    } catch {
      /* toast host not mounted (e.g. tests) */
    }
  }, 800);
}

/** Record a completed challenge's score into the profile store (idempotent â€” only writes on a new
 *  best). When `announce` and the score just locked this tick (prev had none), celebrate once. */
function syncChallengeBest(prev: GameState, next: GameState, announce: boolean): void {
  const ch = next.activeChallenge;
  if (!ch || next.challengeScore == null) return;
  const key = challengeKey(ch.kind, ch.dateKey);
  // The score is immutable once locked, so after the locking tick this call is a recurring no-op —
  // skip it when the store already holds this score or better. (Retries only when the earlier write
  // failed, e.g. storage quota, so nothing observable changes.)
  if (prev.challengeScore != null) {
    const recorded = bestScore(key);
    if (recorded != null && recorded >= next.challengeScore) return;
  }
  const { improved, best } = recordChallengeBest(key, next.challengeScore);
  if (!announce || prev.challengeScore != null) return; // only on the locking transition
  sfx("challenge");
  const label = ch.kind === "weekly" ? "Weekly challenge" : "Daily challenge";
  const scored = formatScore(ch.scoreMetric, next.challengeScore);
  const tail = improved ? ", new best!" : ` Â· best ${formatScore(ch.scoreMetric, best)}`;
  setTimeout(() => {
    try {
      showToast(`${label} complete, ${scored}${tail}`, {
        tone: "positive",
        glyph: createElement(achievementIcon("Trophy"), { size: 15 }),
      });
    } catch {
      /* toast host not mounted (e.g. tests) */
    }
  }, 800);
  // Challenge Seasons â€” count this completion toward the month's cosmetic track (idempotent per
  // challenge key). Any rung crossed unlocks a cosmetic; celebrate it with a toast + confetti (no new
  // interrupt). Entirely a profile-store write â€” no GameState / determinism surface.
  try {
    const { seasonId, crossed } = recordSeasonCompletion(key);
    crossed.forEach((reward, i) => {
      setTimeout(() => {
        try {
          emitCelebrate();
          showToast(`Season reward unlocked, ${reward.name} Â· ${seasonLabel(seasonId)}`, {
            tone: "positive",
            glyph: <Sparkles size={15} />,
          });
        } catch {
          /* toast host not mounted (e.g. tests) */
        }
      }, 1400 + i * 900);
    });
  } catch {
    /* seasons is best-effort flair â€” never let it disrupt the challenge flow */
  }
}

/** The per-tick DATA slice of the context â€” changes whenever the sim advances. */
interface GameStateValue {
  state: GameState;
  paused: boolean;
  fast: boolean;
  skipping: boolean;
  /** True when ANOTHER tab/window took over this save â€” this tab is frozen (no tick, no saves). */
  tabBlocked: boolean;
  /** True while â‰¥1 interrupt overlay is holding the sim (ref-counted, separate from the user's
   *  manual `paused`). The tick gates on this so the world never runs on behind a decision modal. */
  suspended: boolean;
  /** True while a challenge/scenario is running and the player's freeform company is stashed and
   *  restorable â€” drives the run trackers' "return to your company" affordance. */
  homeSaved: boolean;
}

/** The ACTIONS slice â€” every callback. All entries are ref-stable for the life of the provider, so
 *  this object keeps a stable identity (see the `actions` memo); it is the single home for the
 *  action list, replacing the old hand-maintained 60-entry dep array that had already drifted. */
interface GameActionsValue {
  setPaused: (p: boolean) => void;
  setFast: (f: boolean) => void;
  setSkipping: (v: boolean) => void;
  /** Ref-counted sim hold used by interrupt overlays (via useHoldSim). Each mounted overlay pushes
   *  once and pops on hide/unmount; the sim is suspended while the count is > 0. Kept separate from
   *  the user's `paused` so overlapping overlays can't corrupt a captured pause state (the old
   *  per-modal wasPaused pattern could strand the sim paused when two overlays handed off). */
  pushSuspend: () => void;
  popSuspend: () => void;
  /** Reload this tab so it boots from the freshest save and claims play back. */
  takeOverHere: () => void;
  build: (product: Product, plannedUnits?: number, channelId?: ChannelId) => { ok: boolean; reason?: string };
  launchReady: (productId: string) => { ok: boolean; reason?: string; launchScore?: number; verdict?: "hit" | "solid" | "flop" | "steady" };
  research: (kind: ComponentKind) => void;
  cancelResearch: () => void;
  cancelQueuedResearch: (ref: string) => void;
  unlockLens: () => void;
  unlockFinish: () => void;
  buyProject: (id: ProjectId) => void;
  hostKeynote: () => void;
  /** Moonshot R&D gambles (feature #5): attempt a visible-odds moonshot. Resolves instantly (toast +
   *  celebrate on success, sober toast on failure). Returns whether it landed (or null if blocked). */
  attemptMoonshot: (id: string) => "success" | "failure" | null;
  /** Pre-launch Keynote gamble (feature #4): announce an in-production build for a hype gamble. */
  announceKeynote: (productId: string) => void;
  resolveStrike: (choice: StrikeResponse) => void;
  collectAwards: () => void;
  dismissRivalry: () => void;
  dismissNemesisTrophy: () => void;
  /** The Vault (engine/secrets.ts) â€” buy one stage of intel on a classified dossier. */
  investigateSecret: (id: string) => void;
  /** Stamp every dossier's current stage as seen (clears the "new leads" badge). */
  markVaultSeen: () => void;
  /** Acknowledge the reveal ceremony for files that opened this week. */
  dismissSecretReveal: () => void;
  resolveEureka: (choice: "bank" | "chase") => EurekaResult;
  resolveCommunityAsk: (accept: boolean) => CommunityAskResult;
  resolveStaffMoment: (optionIndex: number) => StaffMomentResult;
  resolveStaffEvent: (optionIndex: number) => StaffEventResult;
  resolvePostLaunch: (optionIndex: number) => PostLaunchResult;
  resolveRegionalEvent: (respond: boolean) => RegionalEventResult;
  buybackShares: (amount: Money) => BuybackResult;
  resolveEarnings: (defend: boolean) => EarningsAckResult;
  acceptSideOrder: () => void;
  claimContract: (id: string) => void;
  fundMegaproject: (id: string) => void;
  buyLegacyPerk: (id: string) => void;
  /** Advance Frontier Tech one tier â€” the endless post-IPO Legacy-Point sink. */
  buyFrontierTier: (lane?: FrontierLaneId) => void;
  declineSideOrder: () => void;
  cancelSideOrder: () => void;
  buyUpgrade: (id: UpgradeId) => void;
  unlockRegion: (id: RegionId) => void;
  acquireFactory: (id: FactoryId) => void;
  negotiateContract: (supplierId: SupplierId, termId: ContractTerm["id"]) => void;
  assign: (id: string, assignment: Assignment) => void;
  train: (id: string) => void;
  rest: (id: string) => void;
  hire: (role: StaffRole, skill: number, name: string) => void;
  hireSpecialist: (which: "autoAssign" | "autoResearch") => void;
  recruit: (tier: RecruitTier) => void;
  hireCandidate: (candidateId: string) => void;
  dismissCandidates: () => void;
  fire: (id: string) => void;
  upgradeHQ: () => void;
  advanceEra: () => void;
  /** Resolve the era-advance mandate draft: adopt an offered mandate id, or decline with null. */
  chooseMandate: (id: string | null) => void;
  goPublic: () => void;
  /** Found the next company (New Game+). Optional Ascension / Heat level makes that run harder. */
  prestige: (ascension?: number) => void;
  restart: () => void;
  /** Begin a scenario run (overwrites the current save with the scenario's authored start). */
  startScenario: (id: string, name?: string) => void;
  /** Begin a daily/weekly challenge (stashing the freeform company first, so returnHome can restore
   *  it). Defaults to today; pass a dateKey to play a specific (e.g. shared-by-code) challenge. */
  /** Start a challenge run. False (with a toast) when refused — already attempted, or the freeform
   *  company couldn't be parked. */
  startChallenge: (kind: ChallengeKind, dateKey?: string) => boolean;
  /** Leave the active challenge/scenario and restore the stashed freeform company. Returns true if a
   *  company was restored, false if there was nothing stashed. */
  returnHome: () => boolean;
  markOnboarded: () => void;
  dismissTutorial: () => void;
  replayCoach: () => void;
  markUnlocksSeen: () => void;
  // save export / import (offline backup)
  exportSave: () => string;
  importSave: (str: string) => boolean;
  /** Time Machine (Pro): rewind the running company to a stored quarterly snapshot. Returns false
   *  when the snapshot is missing, unreadable, or Pro has lapsed. */
  rewindTo: (snapshotId: string) => boolean;
  setCompanyName: (name: string) => void;
  setSandboxActive: (on: boolean) => void;
  /** Calm Mode â€” set how often the game may raise opportunistic full-screen interrupts. */
  setInterruptPace: (pace: InterruptPace) => void;
  setAutomation: (patch: Partial<GameState["automation"]>) => void;
  // Platform / OS division (DLC #1)
  setOsName: (name: string) => void;
  unlockPlatform: (on: boolean) => void;
  foundPlatform: () => void;
  releaseOsVersion: () => void;
  shipSecurityPatch: () => boolean;
  licenseOsToRival: (rivalId: string) => void;
  revokeOsLicense: (rivalId: string) => void;
  signLicenseOffer: () => boolean;
  declineLicenseOffer: () => void;
  negotiateLicenseOffer: () => { outcome: NegotiationOutcome; bonusDelta: Money } | null;
  installOsFeature: (id: string) => void;
  setOsPhilosophy: (id: string | null) => void;
  // office builder
  placeFurniture: (type: FurnitureId, c: number, r: number, rot: Rot) => void;
  moveFurniture: (iid: string, c: number, r: number) => void;
  rotateFurniture: (iid: string) => void;
  removeFurniture: (iid: string) => void;
  duplicateFurniture: (iid: string) => void;
  resetFurniture: () => void;
  setLayout: (layout: PlacedItem[]) => void;
  applyLayoutSnapshot: (snap: { layout: PlacedItem[]; cash: Money }) => void;
  /** Restore a Factory-floor undo snapshot (layout + props + cash) â€” the office builder's undo,
   *  finally available on the floor too. */
  applyFactorySnapshot: (snap: { floor: import("../engine/factoryFloor.ts").FactoryFloor; props: import("../engine/factoryProps.ts").PlacedProp[]; cash: Money }) => void;
  setFloorStyle: (i: number) => void;
  setWallStyle: (i: number) => void;
  setFactoryDecor: (patch: Partial<{ wall: number; floor: number }>) => void;
  // equity / stock market
  buyShares: (id: string, qty: number) => void;
  sellShares: (id: string, qty: number) => void;
  acquireRival: (id: string) => boolean;
  boardNudge: (id: string) => void;
  listCompany: (stake: number) => void;
  sellOwnStake: (pct: number) => void;
  cutProductPrice: (productId: string, newPrice: Money) => { ok: boolean; reason?: string };
  marketingPush: (productId: string) => { ok: boolean; reason?: string };
  investBrandAwareness: (points: number) => { ok: boolean; reason?: string };
  restockProduct: (productId: string, units: number) => { ok: boolean; reason?: string };
  setReorderRate: (productId: string, rate: number) => { ok: boolean; reason?: string };
  harvestProduct: (productId: string) => { ok: boolean; reason?: string };
  rushBuild: (productId: string) => { ok: boolean; reason?: string };
  buyFloorMachine: (kind: import("../engine/factoryFloor.ts").MachineKind, c: number, r: number) => { ok: boolean; reason?: string };
  buyFloorBelt: (c: number, r: number, dir: import("../engine/factoryFloor.ts").BeltDir) => { ok: boolean; reason?: string };
  paintBeltRun: (cells: { c: number; r: number }[], dir: import("../engine/factoryFloor.ts").BeltDir) => { ok: boolean; reason?: string };
  buyFactoryProp: (kind: import("../engine/factoryProps.ts").PropKind, c: number, r: number) => { ok: boolean; reason?: string };
  buyFloorExpansion: () => { ok: boolean; reason?: string };
  upgradeFloorMachine: (c: number, r: number) => { ok: boolean; reason?: string };
  moveFloorMachine: (id: string, c: number, r: number) => { ok: boolean; reason?: string };
  moveFactoryProp: (id: string, c: number, r: number) => { ok: boolean; reason?: string };
  autoConnectLine: () => { ok: boolean; reason?: string };
  clearFloorCell: (c: number, r: number) => void;
  saveFactoryLayout: (name: string) => { ok: boolean; reason?: string };
  applyFactoryLayout: (id: string) => { ok: boolean; reason?: string };
  deleteFactoryLayout: (id: string) => void;
  giveRaise: (id: string) => void;
  resolveChoice: (optionId: string) => void;
  resolvePoach: (accept: boolean) => void;
  takeLoan: (principalCents: number) => void;
  repayLoan: (id: string) => void;
  boostMorale: (kind: MoraleKind) => void;
  setTeamFocus: (focus: "research" | "build" | null) => void;
}

/** Full context shape â€” data + actions. `useGame()` returns this (back-compat). */
type GameContextValue = GameStateValue & GameActionsValue;

/** The rare-change control flags beside the sim (F36 context split). Everything here changes only
 *  when the player toggles pace, an overlay suspends the sim, or a side-run is stashed â€” never on
 *  the weekly tick â€” so consumers of this context alone re-render a handful of times per session,
 *  not once per simulated week. */
export type GameControlsValue = Omit<GameStateValue, "state">;

/**
 * Minimal external store for GameState (F36 â€” the performance context split).
 *
 * The old provider held the game in `useState`, so EVERY tick re-rendered the provider and, through
 * it, the whole tree. State now lives outside React: the tick writes here, subscribers are notified,
 * and only components that actually subscribe (via useGame/useGameSelector) re-render. The provider
 * itself renders once per session plus on control-flag changes.
 *
 * `set` preserves React's bail-out semantics: an updater that returns the same object notifies no
 * one, so the many gated no-op reducers keep today's behaviour exactly.
 */
class GameStore {
  private state: GameState;
  private listeners = new Set<() => void>();
  constructor(initial: GameState) {
    this.state = initial;
  }
  getState = (): GameState => this.state;
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };
  set = (next: GameState | ((s: GameState) => GameState)): void => {
    const value = typeof next === "function" ? (next as (s: GameState) => GameState)(this.state) : next;
    if (value === this.state) return; // bail-out: identical object â†’ no notification
    this.state = value;
    for (const l of this.listeners) l();
  };
}

const StoreContext = createContext<GameStore | null>(null);
const ControlsContext = createContext<GameControlsValue | null>(null);
const ActionsContext = createContext<GameActionsValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  // Load the save as-is. Time does NOT advance while the app is closed â€” the sim only runs on the
  // weekly tick below â€” so there is no offline catch-up: a returning player picks up exactly where
  // they stopped, with no fast-forwarded weeks and no "while you were away" recap.
  const boot = useMemo(() => {
    const res = loadResult();
    if (res.status !== "ok") {
      // ABSENT or UNREADABLE â†’ start fresh. On UNREADABLE the raw save was already copied to a
      // backup key inside loadResult(), so the player's data is preserved, not destroyed.
      return withInterruptPace(newGame(undefined, getLegacy()));
    }
    // Honor sandboxUnlocked only when the device actually owns the IAP â€” an imported or older
    // localStorage save could otherwise unlock the unlimited-cash floor for free.
    const loaded = withValidatedSandbox(res.state);
    // F4 â€” seed the feed-id counter above restored ids BEFORE any new feed item is generated.
    seedFeedSeq(loaded);
    // Capture the loaded run's earned achievements into the cross-run profile store â€” this handles
    // saves written before the profile-achievements system existed (independent of any catch-up).
    mergeProfileAchievements(loaded.unlockedAchievements);
    return withInterruptPace(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F36 â€” the game lives in an external store, not useState: the weekly tick writes here and only
  // subscribed components re-render. The provider itself no longer re-renders per tick.
  const store = useMemo(() => new GameStore(boot), []);
  /** Live GameState read for imperative action bodies (was gs()). */
  const gs = store.getState;
  // The two sim-gating flags the TICK effect needs reactively. Selector-subscribed, so the provider
  // re-renders only when one of them actually flips â€” never on an ordinary week.
  const bankrupt = useStoreSelector(store, (s) => s.bankrupt);
  const onboarded = useStoreSelector(store, (s) => s.onboarded);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  // "Skip to next decision" â€” run at Fast speed until a week produces something that needs the
  // player's input (skipInterrupt), then auto-pause with a one-line reason. Decision-paced time.
  const [skipping, setSkipping] = useState(false);
  const [tabBlocked, setTabBlocked] = useState(false);
  // A throw out of the weekly tick used to be INVISIBLE and unrecoverable. The tick body runs inside
  // `setInterval`, and React error boundaries only catch throws from render/lifecycle — never from a
  // timer callback. So if `advanceOneWeek` (or any of the toast/unlock side-effects below it) threw on
  // some particular week+state, the exception escaped to the browser, the store kept its last good
  // state, and the interval went right on firing — throwing again every tick, forever. What the player
  // saw was a game whose clock had simply stopped: no error, no card, no hint, and a Reload that
  // restored the same save and froze at the same week again.
  // Captured here and re-thrown during render instead, so the ROOT ErrorBoundary in App.tsx handles it
  // like any other crash — with the copyable report, Reload, and the guarded Reset. `store.set`
  // evaluates the updater BEFORE assigning (see GameStore.set), so a throw leaves the last committed
  // week intact and the save on disk is still the last good one.
  const [tickError, setTickError] = useState<Error | null>(null);
  // True while the player's freeform company is stashed because a challenge/scenario is running in the
  // main slot â€” drives the "return to your company" affordance in the run trackers. Seeded from disk so
  // it survives a reload mid-challenge (the stash is a separate key from the autosaved challenge run).
  const [homeSaved, setHomeSaved] = useState<boolean>(() => hasHomeSave());
  // Ref-counted sim hold for interrupt overlays. Each visible overlay pushes once (via useHoldSim)
  // and pops on hide/unmount; the sim is suspended while the count is > 0. This REPLACES the old
  // pattern where every modal imperatively toggled the shared `paused` flag and tried to restore a
  // captured `wasPaused` â€” two overlays handing off (e.g. a finished build's Ready-to-launch popup
  // overlapping a quarterly earnings call) could capture each other's forced-true value and strand
  // the sim paused with no visible modal. Counting is monotonic and per-overlay, so it can't corrupt.
  const suspendCount = useRef(0);
  const [suspended, setSuspended] = useState(false);
  const pushSuspend = useCallback(() => {
    suspendCount.current += 1;
    setSuspended(suspendCount.current > 0);
  }, []);
  const popSuspend = useCallback(() => {
    suspendCount.current = Math.max(0, suspendCount.current - 1);
    setSuspended(suspendCount.current > 0);
  }, []);
  // Save paths are mount-once effects; they read the live blocked flag through a ref.
  const tabBlockedRef = useRef(tabBlocked);
  tabBlockedRef.current = tabBlocked;
  // Sim pauses while the page/app is backgrounded so hidden wall-time is reconciled EXACTLY ONCE
  // on resume (below) instead of being partially simulated by a throttled interval (web) or lost
  // entirely while JS is suspended (iOS). WKWebView fires visibilitychange on iOS background, so
  // this one path covers web + the Capacitor app.
  const [hidden, setHidden] = useState(false);
  // The exact state object last written, so the periodic safety-net save can skip when nothing
  // changed (advanceOneWeek + every action return a NEW object, so reference identity = "dirty").
  const lastSavedRef = useRef<GameState>(boot);

  // Multi-tab single-writer guard: when another tab claims this save, freeze this one â€” the tick
  // stops below and EVERY save path checks tabBlockedRef, so a stale context can never clobber
  // the tab the player is actually using (the one real save-loss path on web). When the playing
  // tab goes away (its pagehide broadcasts a release), a frozen tab the player is LOOKING AT
  // recovers by reloading into the freshest save; a hidden frozen tab keeps the overlay's
  // "Play here instead" CTA (auto-reloading something off-screen buys nothing).
  useEffect(() => {
    const guard = createTabGuard(
      () => setTabBlocked(true),
      undefined,
      () => {
        if (document.visibilityState === "visible") window.location.reload();
      },
    );
    return guard.dispose;
  }, []);
  const takeOverHere = useCallback(() => window.location.reload(), []);

  // Sim tick. One week per tick; the interval shrinks by fastMultiplier in Fast mode.
  // Gated on onboarded: the sim must not burn rent/shift trends while the player is still on
  // the name screen (pre-fix, ~13 idle minutes there bankrupted the save before it began).
  // The tick body runs exactly once per interval fire (the store invokes the updater itself, so
  // React's StrictMode double-invoke no longer applies), but the once-per-week announce guard is
  // kept — it also dedupes a tick that lands in the same week twice across interval recreations.
  // Time Machine (Pro): quietly snapshot the freeform campaign each quarter.
  //
  // Deliberately a store SUBSCRIPTION rather than a line inside the tick's updater. The updater is
  // pure state-in/state-out; persistence happens here, keyed on committed changes, so a week is
  // saved exactly when it really happened.
  //
  // It never writes back to the game, so the simulation is byte-identical whether or not the player
  // has Pro. Self-gating on entitlement, run type and cadence: a no-op on all three counts most weeks.
  const announcedWeekRef = useRef(-1);
  useEffect(() => {
    if (paused || suspended || hidden || bankrupt || tabBlocked || !onboarded) return;
    const ms = (BALANCE.secondsPerTick / (fast || skipping ? BALANCE.fastMultiplier : 1)) * 1000;
    const id = setInterval(() => {
      try {
      store.set((s) => {
        const next = withScenarioRunStars(withChallengeScore(advanceOneWeek(s)));
        const firstThisWeek = next.week !== announcedWeekRef.current;
        if (firstThisWeek) {
          announcedWeekRef.current = next.week; // claim the week first (StrictMode double-invoke guard)
          // Record this week's challenge best BEFORE mastery is read, so a challenge that locks
          // this tick is counted now (no one-cycle lag for challenges-10). Idempotent.
          syncChallengeBest(s, next, true);
          // Skip-to-next-decision: the week produced something that needs input â†’ stop time and
          // say why. Gated to once per simulated week like every other tick side-effect.
          if (skipping) {
            const why = skipInterrupt(s, next);
            if (why) {
              setSkipping(false);
              setPaused(true);
              showToast(`Paused, ${why.toLowerCase()}`, { tone: "neutral" });
            }
          }
        }
        const { state: out, unlocked } = evaluateAndUnlock(next, readMasteryInput());
        const { state: out2, completed } = evaluateObjectives(out);
        if (firstThisWeek) {
          // Calm Mode also quiets the non-actionable TOAST fire-hose (all of these also land in the
          // feed, so dropping the toast removes duplication, not information). Relaxed silences the
          // pure milestone spam (revenue / fans / staff level-ups); Calm additionally silences the
          // run/research summaries. Reward unlocks (achievements / objectives) always show.
          const pace = next.interruptPace;
          const quietMilestones = pace === "relaxed" || pace === "calm";
          const quietSummaries = pace === "calm";
          if (!quietMilestones) {
            withRevToasts(s, next);
            withFanToasts(s, next);
            withStaffLevelToasts(s, next);
          }
          if (!quietSummaries) {
            withProductFinishToasts(s, next);
            withResearchCompleteFx(s, next);
          }
          announceAchievements(unlocked);
          mergeProfileAchievements(unlocked);
          // A dossier that opened this week joins the lifetime codex: the boon resets with the next
          // company, but what this founder LEARNED is theirs for good. Idempotent (a union merge), so
          // a StrictMode double-invoke can't double-write. The reveal ceremony does the celebrating.
          if ((next.secretsFound?.length ?? 0) > (s.secretsFound?.length ?? 0)) {
            mergeCodex(next.secretsFound);
          }
          announceObjectives(completed);
          announceScenarioStars(next);
          // A commission finishing is a payday â€” celebrate it from any tab.
          if ((next.sideOrdersCompleted ?? 0) > (s.sideOrdersCompleted ?? 0)) {
            sfx("cash");
            showToast("Commission delivered â€” payment banked", { tone: "positive" });
          }
          // A paid-for recruiter shortlist EXPIRES quietly â€” the arrival must not (the player
          // may be on any tab when the candidates land).
          if (next.candidates.length > 0 && s.candidates.length === 0) {
            sfx("confirm");
            showToast(`Your shortlist arrived â€” ${next.candidates.length} candidate${next.candidates.length > 1 ? "s" : ""} to interview`, { tone: "positive" });
          }
        }
        return out2;
      });
      } catch (e) {
        setTickError(e instanceof Error ? e : new Error(String(e)));
      }
    }, ms);
    return () => clearInterval(id);
  }, [store, paused, suspended, hidden, fast, skipping, bankrupt, tabBlocked, onboarded]);

  // One write path for every persistence trigger below: skip while another tab owns the save. The
  // old three inlined copies of this had already drifted once (the double-offline bug). `lastActive`
  // is stamped as a "last saved at" timestamp; nothing reads it anymore (offline catch-up is gone).
  const persistNow = useCallback(() => {
    if (tabBlockedRef.current) return;
    const snap = gs();
    save({ ...snap, lastActive: Date.now() });
    lastSavedRef.current = snap;
  }, []);

  // Store subscription replacing the old per-render `[state]` effects: on EVERY committed change,
  // snapshot the freeform campaign if a quarter is due (Time Machine), then debounce the save so the
  // crash-loss window after any action stays ≤1s without re-serializing unchanged state. Mount-once;
  // reads everything through refs/store so it never needs to re-arm.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = store.subscribe(() => {
      const snap = gs();
      captureIfDue(snap);
      if (!tabBlockedRef.current) {
        clearTimeout(timer);
        timer = setTimeout(persistNow, 800);
      }
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [store, gs, persistNow]);

  // Safety net for the one case the debounce can starve â€” continuous Fast-mode ticks faster than
  // the debounce window. Only writes when the state actually changed since the last save.
  useEffect(() => {
    const id = setInterval(() => {
      if (gs() !== lastSavedRef.current) persistNow();
    }, 10_000);
    return () => clearInterval(id);
  }, [persistNow]);

  // Pause the sim on hide (persisting first) and simply resume it on show. Time does NOT advance while
  // the app is backgrounded and is NOT caught up on return â€” the player picks up exactly where they
  // left off. (The tick's `hidden` gate stops the sim; foregrounding clears it and the tick restarts.)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        persistNow();
        setHidden(true);
      } else {
        setHidden(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", persistNow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", persistNow);
    };
  }, [persistNow]);

  const build = useCallback((product: Product, plannedUnits?: number, channelId?: ChannelId) => {
    const result = startBuild(gs(), product, plannedUnits, channelId);
    if (result.ok) {
      const spent = (gs().cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);

  const launchReadyCb = useCallback((productId: string) => {
    const result = launchReady(gs(), productId);
    // A launch can immediately cross a milestone (first ship, a hit, a hit streak, a sellout) â€” so
    // evaluate + celebrate right here, not only on the next weekly tick.
    if (result.ok) {
      const next = withLiveAchievements(result.state);
      // Enshrine the freshly-shipped device in the permanent museum (newest is launched[0]).
      const lp = next.launched[0];
      if (lp) {
        addMuseumEntry({
          // uniqueMuseumKey: a fixed-seed replay (daily challenge / shared code) shipping the same
          // product at the same week must enshrine a NEW entry, not overwrite the earlier one.
          key: uniqueMuseumKey(`${next.seed}-${lp.product.id}-${lp.launchedWeek}`),
          product: lp.product,
          name: lp.product.name,
          category: lp.product.category,
          era: next.era,
          companyName: next.companyName,
          week: lp.launchedWeek,
          verdict: lp.verdict,
          insight: lp.insight,
          launchScore: lp.launchScore,
          forecastUnits: lp.totalUnits,
        });
      }
      store.set(next);
    }
    return { ok: result.ok, reason: result.reason, launchScore: result.launchScore, verdict: result.verdict };
  }, []);

  // Start â€” or queue â€” the next tier of a component line (timed research). Pays RP up front; the unlock
  // lands after a few weeks (shown by the progress ring). If the lab is busy it lines up in the queue.
  const research = useCallback((kind: ComponentKind) => {
    const prev = gs();
    const next = startResearchTier(prev, kind);
    if (next === prev) { haptic.error(); return; }
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) { emitRpSpend(rpSpent); sfx("confirm"); haptic.success(); }
    const queued = (next.researchQueue?.length ?? 0) > (prev.researchQueue?.length ?? 0);
    showToast(queued ? `Queued ${next.researchQueue!.at(-1)!.name}` : `Researching ${next.activeResearch?.name ?? "tech"}`, { tone: "neutral" });
    store.set(next);
  }, []);
  // Cancel the active research (pulls the next queued one up) or a specific queued item â€” both refund RP.
  const cancelResearchCb = useCallback(() => {
    const prev = gs();
    const next = cancelResearch(prev);
    if (next === prev) return;
    sfx("toggle"); haptic.light();
    store.set(next);
  }, []);
  const cancelQueuedResearchCb = useCallback((ref: string) => {
    const prev = gs();
    const next = cancelQueuedResearch(prev, ref);
    if (next === prev) return;
    sfx("toggle"); haptic.light();
    store.set(next);
  }, []);

  const unlockLensCb = useCallback(() => {
    const prev = gs();
    const next = unlockLens(prev);
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    store.set(next);
  }, []);
  const unlockFinishCb = useCallback(() => {
    const prev = gs();
    const next = unlockFinish(prev);
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    store.set(next);
  }, []);
  // Start developing a company research project (timed). Pays RP up front; the completion celebration
  // fires from the tick diff (withResearchCompleteFx) when the lab actually finishes it a few weeks on.
  const buyProjectCb = useCallback((id: ProjectId) => {
    const prev = gs();
    const next = startResearchProject(prev, id);
    if (next === prev) { haptic.error(); return; }
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) { emitRpSpend(rpSpent); sfx("confirm"); haptic.success(); }
    const queued = (next.researchQueue?.length ?? 0) > (prev.researchQueue?.length ?? 0);
    showToast(`${queued ? "Queued" : "Researching"} ${projectById(id).name}`, { tone: "neutral" });
    store.set(next);
  }, []);
  const buyUpgradeCb = useCallback((id: UpgradeId) => {
    const prev = gs();
    const next = buyUpgrade(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const acceptSideOrderCb = useCallback(() => {
    const prev = gs();
    const res = acceptSideOrder(prev);
    if (!res.ok) { showToast(res.reason ?? "Can't take the order", { tone: "negative" }); return; }
    haptic.success();
    sfx("confirm");
    store.set(res.state);
  }, []);
  const claimContractCb = useCallback((id: string) => {
    const prev = gs();
    const res = claimContract(prev, id);
    if (!res.ok) { haptic.error(); showToast(res.reason ?? "Not ready to claim", { tone: "negative" }); return; }
    haptic.success();
    sfx("cash");
    store.set(res.state);
  }, []);
  // Fund a moonshot megaproject (item 4.1) â€” a post-IPO cash + RP sink with a prestige payoff.
  const fundMegaprojectCb = useCallback((id: string) => {
    const prev = gs();
    const res = fundMegaproject(prev, id);
    if (!res.ok) { haptic.error(); showToast(res.reason ?? "Can't fund that yet", { tone: "negative" }); return; }
    // A megaproject buy-in is a large cash + RP spend â€” surface the same "-$X" / "-RP" feedback as
    // every other spend action so the outlay is legible.
    const spent = (prev.cash - res.state.cash) as Money;
    if (spent > 0) emitSpend(spent);
    const rpSpent = prev.researchPoints - res.state.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    haptic.success();
    sfx("cash");
    store.set(res.state);
  }, []);
  // Spend Legacy Points on a Legacy-tree perk (item 4.3) â€” a permanent-for-this-run boon.
  const buyLegacyPerkCb = useCallback((id: string) => {
    const prev = gs();
    const res = buyLegacyPerk(prev, id);
    if (!res.ok) { haptic.error(); showToast(res.reason ?? "Can't unlock that yet", { tone: "negative" }); return; }
    haptic.success();
    sfx("confirm");
    store.set(res.state);
  }, []);
  const buyFrontierTierCb = useCallback((lane: FrontierLaneId = "research") => {
    const prev = gs();
    const res = buyFrontierTier(prev, lane);
    if (!res.ok) { haptic.error(); showToast(res.reason ?? "Can't advance the frontier yet", { tone: "negative" }); return; }
    haptic.success();
    sfx("confirm");
    store.set(res.state);
  }, []);
  const declineSideOrderCb = useCallback(() => {
    haptic.light();
    store.set(declineSideOrder(gs()));
  }, []);
  const cancelSideOrderCb = useCallback(() => {
    const prev = gs();
    const res = cancelSideOrder(prev);
    if (!res.ok) { showToast(res.reason ?? "Can't cancel right now", { tone: "negative" }); return; }
    const spent = (prev.cash - res.state.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(res.state);
  }, []);
  const collectAwardsCb = useCallback(() => {
    const prev = gs();
    const wins = prev.pendingAwards?.playerWins ?? 0;
    const next = collectAwards(prev);
    if (next === prev) return;
    if (wins > 0) {
      emitCelebrate();
      sfx("mastery");
      haptic.success();
    }
    store.set(next);
  }, []);
  const dismissRivalryCb = useCallback(() => store.set((s) => dismissRivalry(s)), []);
  const dismissNemesisTrophyCb = useCallback(() => store.set((s) => dismissNemesisTrophy(s)), []);
  // Resolve a eureka breakthrough â€” bank the sure RP or chase the prototype gamble. Returns the outcome
  // so the overlay can stage the reveal; RP-gain FX + sound scale with whether the prototype landed.
  const resolveEurekaCb = useCallback((choice: "bank" | "chase"): EurekaResult => {
    const prev = gs();
    const { state: next, result } = resolveEureka(prev, choice);
    if (!result.ok) return result;
    if (result.jackpot) { emitCelebrate(); sfx("mastery"); haptic.success(); }
    else { sfx(choice === "bank" ? "rp" : "confirm"); haptic.light(); }
    store.set(next);
    return result;
  }, []);
  // Answer or pass on a community ask. Answering spends cash (spend FX) and delights the base; passing
  // is a small mood dip. Returns the outcome so the overlay can stage its reveal.
  const resolveCommunityAskCb = useCallback((accept: boolean): CommunityAskResult => {
    const prev = gs();
    if (!prev.pendingCommunityAsk) return { ok: false }; // a double input is a no-op, not an error
    const { state: next, result } = resolveCommunityAsk(prev, accept);
    if (!result.ok) { if (result.reason) showToast(result.reason, { tone: "negative" }); return result; }
    if (result.answered) {
      const spent = (prev.cash - next.cash) as Money;
      if (spent > 0) emitSpend(spent);
      sfx("confirm"); haptic.success();
    } else { sfx("tap"); haptic.light(); }
    store.set(next);
    return result;
  }, []);
  // Apply a staff growth moment's chosen upgrade (a permanent character perk). A celebratory beat.
  const resolveStaffMomentCb = useCallback((optionIndex: number): StaffMomentResult => {
    const prev = gs();
    if (!prev.pendingStaffMoment) return { ok: false }; // a double input is a no-op, not an error
    const { state: next, result } = resolveStaffMoment(prev, optionIndex);
    if (!result.ok) { if (result.reason) showToast(result.reason, { tone: "negative" }); return result; }
    emitCelebrate(); sfx("levelup"); haptic.success();
    if (result.staffName) showToast(`${result.staffName} grew`, { tone: "positive", glyph: <Sparkles size={15} /> });
    store.set(next);
    return result;
  }, []);
  // Answer a staff LIFE event (item 2.2) â€” a small human choice about a named teammate.
  const resolveStaffEventCb = useCallback((optionIndex: number): StaffEventResult => {
    const prev = gs();
    if (!prev.pendingStaffEvent) return { ok: false }; // a double input is a no-op, not an error
    const { state: next, result } = resolveStaffEvent(prev, optionIndex);
    if (!result.ok) { if (result.reason) showToast(result.reason, { tone: "negative" }); return result; }
    const spent = (prev.cash - next.cash) as Money; // an option may cost cash (a raise, a course)
    if (spent > 0) emitSpend(spent);
    sfx("confirm"); haptic.success();
    store.set(next);
    return result;
  }, []);
  // Answer a post-launch reactive event (item 3.6) â€” a business call on a product already selling.
  const resolvePostLaunchCb = useCallback((optionIndex: number): PostLaunchResult => {
    const prev = gs();
    if (!prev.pendingPostLaunch) return { ok: false }; // a double input is a no-op, not an error
    const { state: next, result } = resolvePostLaunch(prev, optionIndex);
    if (!result.ok) { if (result.reason) showToast(result.reason, { tone: "negative" }); return result; }
    const spent = (prev.cash - next.cash) as Money; // an option may cost cash (a hype push / securing parts)
    if (spent > 0) emitSpend(spent);
    sfx("confirm"); haptic.success();
    store.set(next);
    return result;
  }, []);
  // Respond to (spend cash) or ignore a regional event; either way it moves that market's standing.
  const resolveRegionalEventCb = useCallback((respond: boolean): RegionalEventResult => {
    const prev = gs();
    if (!prev.pendingRegionalEvent) return { ok: false }; // a double input is a no-op, not an error
    const { state: next, result } = resolveRegionalEvent(prev, respond);
    if (!result.ok) { if (result.reason) showToast(result.reason, { tone: "negative" }); return result; }
    if (respond) {
      const spent = (prev.cash - next.cash) as Money;
      if (spent > 0) emitSpend(spent);
      sfx("confirm"); haptic.success();
    } else { sfx("tap"); haptic.light(); }
    store.set(next);
    return result;
  }, []);
  // Buy back the company's own shares â€” spend cash to raise ownership + nudge the price up. Spend FX.
  const buybackSharesCb = useCallback((amount: Money): BuybackResult => {
    const prev = gs();
    const { state: next, result } = buybackShares(prev, amount);
    if (!result.ok) { if (result.reason) showToast(result.reason, { tone: "negative" }); return result; }
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    sfx("cash"); haptic.success();
    store.set(next);
    return result;
  }, []);
  // Acknowledge a quarterly earnings call; on a miss, `defend` runs a steadying buyback.
  const resolveEarningsCb = useCallback((defend: boolean): EarningsAckResult => {
    const prev = gs();
    if (!prev.pendingEarnings) return { ok: false };
    const { state: next, result } = resolveEarnings(prev, defend);
    if (result.defended) { const spent = (prev.cash - next.cash) as Money; if (spent > 0) emitSpend(spent); sfx("cash"); }
    else sfx("tap");
    haptic.light();
    store.set(next);
    return result;
  }, []);
  const resolveStrikeCb = useCallback((choice: StrikeResponse) => {
    const prev = gs();
    if (!prev.pendingStrike) return; // a second input (Escape + scrim in one frame) is a no-op, not an error
    const result = resolveStrike(prev, choice);
    if (!result.ok) {
      showToast(result.reason ?? "Can't do that right now", { tone: "negative" });
      return;
    }
    const spent = (prev.cash - result.state.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(result.state);
  }, []);
  const hostKeynoteCb = useCallback(() => {
    const prev = gs();
    const next = hostKeynote(prev);
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) {
      emitRpSpend(rpSpent);
      emitCelebrate();
      sfx("confirm");
      showToast(`Keynote! +${(next.fans - prev.fans).toLocaleString()} fans`, { tone: "positive" });
    }
    store.set(next);
  }, []);
  // Moonshot R&D gambles (feature #5) â€” attempt a visible-odds gamble; the outcome is revealed instantly.
  const attemptMoonshotCb = useCallback((id: string): "success" | "failure" | null => {
    const prev = gs();
    const res = attemptMoonshot(prev, id);
    if (!res.ok) { haptic.error(); showToast(res.reason ?? "Can't attempt that moonshot", { tone: "negative" }); return null; }
    const rpSpent = prev.researchPoints - res.state.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    const m = moonshotById(id);
    if (res.moonshotOutcome === "success") {
      emitCelebrate();
      sfx("mastery");
      haptic.success();
      showToast(`Moonshot landed â€” ${m?.reward.label ?? "reward banked"}`, { tone: "positive", glyph: <Rocket size={15} /> });
    } else {
      sfx("confirm");
      haptic.warning();
      showToast(`${m?.name ?? "Moonshot"} missed â€” most of the RP burned, some salvaged`, { tone: "negative", glyph: <Rocket size={15} /> });
    }
    store.set(res.state);
    return res.moonshotOutcome ?? null;
  }, []);
  // The Vault (engine/secrets.ts) â€” buy one stage of a dossier's reveal. Cash out, knowledge in; the
  // reducer refuses anything that would sell the achievement itself.
  const investigateSecretCb = useCallback((id: string) => {
    const prev = gs();
    const res = investigateSecret(prev, id);
    if (!res.ok) { haptic.error(); showToast(res.reason ?? "That lead went nowhere", { tone: "negative" }); return; }
    const spent = (prev.cash - res.state.cash) as Money;
    if (spent > 0) emitSpend(spent);
    sfx("confirm");
    haptic.light();
    const card = secretById(id);
    const decrypted = (res.state.secretStages?.[id] ?? 0) >= STAGE_DECRYPTED;
    showToast(
      decrypted ? `File open: ${card?.codename ?? "the dossier"}` : `A name surfaced: ${card?.codename ?? "something"}`,
      { tone: "positive", glyph: <FileSearch size={15} /> },
    );
    store.set(res.state);
  }, []);
  const markVaultSeenCb = useCallback(() => store.set((s) => markVaultSeen(s)), []);
  const dismissSecretRevealCb = useCallback(() => store.set((s) => dismissSecretReveal(s)), []);
  const announceKeynoteCb = useCallback((productId: string) => {
    const prev = gs();
    const next = announceKeynote(prev, productId);
    if (next === prev) { haptic.error(); return; } // no-op: not building / already announced / cap spent
    emitCelebrate();
    sfx("confirm");
    haptic.success();
    showToast(`Keynote announced â€” the promise is public. +${(next.fans - prev.fans).toLocaleString()} fans`, { tone: "positive" });
    store.set(next);
  }, []);
  const unlockRegionCb = useCallback((id: RegionId) => {
    const prev = gs();
    const next = unlockRegion(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const acquireFactoryCb = useCallback((id: FactoryId) => {
    const prev = gs();
    const next = acquireFactory(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const negotiateContractCb = useCallback((supplierId: SupplierId, termId: ContractTerm["id"]) => {
    const prev = gs();
    const next = negotiateContract(prev, supplierId, termId);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const assign = useCallback((id: string, a: Assignment) => store.set((s) => assignStaff(s, id, a)), []);
  const train = useCallback((id: string) => {
    const prev = gs();
    const next = trainStaff(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const rest = useCallback((id: string) => {
    const prev = gs();
    const next = restStaff(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);

  const hire = useCallback((role: StaffRole, skill: number, name: string) => {
    const prev = gs();
    const next = hireStaff(prev, role, skill, name);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const hireSpecialistCb = useCallback((which: "autoAssign" | "autoResearch") => {
    const prev = gs();
    const next = hireSpecialist(prev, which);
    if (next === prev) return; // no-op (division not opened / at capacity) â€” no false confirmation
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    // A specialist joining unlocks delegation â€” a real moment, not a silent debit (matches hire).
    haptic.success();
    sfx("confirm");
    showToast(
      which === "autoResearch" ? "Lead Researcher hired â€” Auto-research unlocked" : "People Lead hired â€” Auto-assign unlocked",
      { tone: "positive" },
    );
    store.set(next);
  }, []);
  const recruit = useCallback((tier: RecruitTier) => {
    const prev = gs();
    const next = startRecruitment(prev, tier);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const hireCandidateCb = useCallback((candidateId: string) => {
    const prev = gs();
    const next = hireCandidate(prev, candidateId);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const dismissCandidates = useCallback(() => store.set((s) => clearCandidates(s)), []);

  const fire = useCallback((id: string) => store.set((s) => fireStaff(s, id)), []);
  const upgradeHQ = useCallback(() => {
    const prev = gs();
    const next = upgradeFacility(prev);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  // These actions can immediately satisfy a milestone (reach the final era, IPO, the pinnacle), so
  // fold + celebrate achievements here rather than waiting for the next tick.
  const advanceEra = useCallback(() => store.set((s) => withLiveAchievements(advanceEraAction(s))), []);
  const chooseMandate = useCallback((id: string | null) => store.set((s) => applyMandateChoice(s, id)), []);
  const goPublicCb = useCallback(() => {
    const before = gs();
    store.set((s) => withLiveAchievements(goPublic(s)));
    // Record the IPO in the lifetime Founder Legend on the first transition to public (guarded so a
    // no-op call â€” canIPO false â€” records nothing).
    if (!before.wentPublic) {
      const after = goPublic(before);
      if (after.wentPublic) recordFounderFrom(after, { ipo: true });
    }
  }, []);
  const prestige = useCallback((ascension = 0) => {
    // Bank the finished empire into the lifetime Founder Legend before the reset wipes the run â€”
    // recording the Heat level cleared this run (recordFounderFrom reads state.ascensionLevel).
    recordFounderFrom(gs(), { prestige: true });
    mergeProfileAchievements(gs().unlockedAchievements); // milestones earned this run persist into NG+
    const next = getLegacy() + 1;
    setLegacy(next);
    clearSave();
    // The retired empire's rewind points die with it â€” the Time Machine must never offer to rewind
    // into a company the player deliberately left behind.
    clearSnapshots();
    // New Game+ players already know the ropes â€” skip onboarding + the first-build coach. The
    // lifetime "seen dilemmas" set carries across so the new run surfaces fresh decisions first.
    // Ascension / Heat: the chosen level makes the NEXT run harder (newGame's 3rd arg).
    store.set(withInterruptPace({ ...newGame(undefined, next, ascension), onboarded: true, tutorialDone: true, platformUnlocked: gs().platformUnlocked, seenChoices: gs().seenChoices }));
    setPaused(false);
    setFast(false); // F37 â€” New Game+ must not inherit fast-forward speed.
    setSkipping(false);
  }, []);
  // Serialize the live state PLUS profile-level progression (legacy, scenario stars, challenge
  // bests, museum) so a backup is complete and survives a device migration.
  const exportSave = useCallback(
    () => exportSaveString(gs(), {
      legacy: getLegacy(),
      scenarioStars: getScenarioStars(),
      challengeBests: getChallengeBests(),
      challengeAttempts: getChallengeAttempts(),
      museum: getMuseum(),
      achievements: getProfileAchievements(),
      founder: getFounderRecord(),
      seasons: getSeasons(),
    }),
    [],
  );

  // Validate + apply an imported backup. Returns false (and changes nothing) on a bad string, so
  // the caller can surface a clear error. On success we set the migrated state immutably, stamp
  // lastActive as the save time, and persist immediately.
  const importSave = useCallback((str: string) => {
    const migrated = importSaveString(str);
    if (!migrated) return false;
    // Restore profile-level progression from a v2 backup (merged, keeping the best â€” never a downgrade).
    const profile = importProfileFromString(str);
    if (profile) {
      if (typeof profile.legacy === "number" && profile.legacy > getLegacy()) setLegacy(profile.legacy);
      mergeScenarioStars(profile.scenarioStars);
      mergeChallengeBests(profile.challengeBests);
      mergeChallengeAttempts(profile.challengeAttempts);
      mergeMuseum(profile.museum);
      mergeProfileAchievements(Array.isArray(profile.achievements) ? profile.achievements : undefined);
      mergeFounderRecord(profile.founder);
      mergeSeasons(profile.seasons);
    }
    const next: GameState = { ...withValidatedSandbox(migrated), lastActive: Date.now() };
    seedFeedSeq(next); // keep feed-id counter above the imported ids
    clearSnapshots(); // the incoming company has no shared history with the snapshots on this device
    save(next);
    store.set(next);
    setPaused(false);
    setFast(false);
    setSkipping(false);
    return true;
  }, []);

  const markOnboarded = useCallback(() => store.set((s) => ({ ...s, onboarded: true })), []);
  const dismissTutorial = useCallback(() => store.set((s) => ({ ...s, tutorialDone: true })), []);
  // Replay the first-build Coach from the Help hub â€” it re-reads progress to pick the right step for
  // where the player is now (a veteran just sees the "you're set" beat and can dismiss again).
  const replayCoach = useCallback(() => store.set((s) => ({ ...s, tutorialDone: false })), []);
  const markUnlocksSeen = useCallback(() => store.set((s) => ({ ...s, seenFirstShipUnlocks: true })), []);
  const setCompanyNameCb = useCallback((name: string) => store.set((s) => setCompanyName(s, name)), []);
  // Toggle Sandbox / Creative mode ON or OFF for the current game. Ownership is enforced by the
  // caller (Settings only shows the toggle once the IAP entitlement is held).
  const setSandboxActive = useCallback((on: boolean) => store.set((s) => setSandbox(s, on)), []);
  // Calm Mode â€” persist the choice (survives a new company) and apply it to the live run immediately.
  const setInterruptPaceCb = useCallback((pace: InterruptPace) => {
    setSettings({ interruptPace: pace });
    store.set((s) => (s.interruptPace === pace ? s : { ...s, interruptPace: pace }));
  }, []);
  const setAutomationCb = useCallback((patch: Partial<GameState["automation"]>) => store.set((s) => setAutomation(s, patch)), []);
  const setOsNameCb = useCallback((name: string) => store.set((s) => setOsName(s, name)), []);
  const unlockPlatformCb = useCallback((on: boolean) => store.set((s) => unlockPlatform(s, on)), []);
  // Found the OS division â€” a major cash reinvestment. Value-call path: emit the spend FX + fold
  // achievements (so any milestone the moment trips celebrates immediately).
  const foundPlatformCb = useCallback(() => {
    const prev = gs();
    const next = foundPlatform(prev);
    if (next === prev) return; // gated no-op (already founded / can't afford)
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(withLiveAchievements(next));
  }, []);
  const releaseOsVersionCb = useCallback(() => {
    store.set((s) => {
      const next = withLiveAchievements(releaseOsVersion(s));
      if (next !== s) sfx("era");
      return next;
    });
  }, []);
  // Ship a security patch (the immersive "update" button). Returns true so the Platform screen can
  // fire its update animation; shows the cooldown reason as a toast when it's not ready yet.
  const shipSecurityPatchCb = useCallback((): boolean => {
    const res = shipSecurityPatch(gs());
    if (!res.ok) { showToast(res.reason ?? "Can't patch right now", { tone: "neutral" }); return false; }
    haptic.success();
    sfx("upgrade");
    store.set(res.state);
    return true;
  }, []);
  const licenseOsToRivalCb = useCallback((rivalId: string) => store.set((s) => licenseOsToRival(s, rivalId)), []);
  const revokeOsLicenseCb = useCallback((rivalId: string) => store.set((s) => revokeOsLicense(s, rivalId)), []);
  // Sign the inbound contract: bank the signing bonus (spend FX in reverse â€” a gain), and return
  // true so the Platform screen can fire its signing celebration.
  const signLicenseOfferCb = useCallback((): boolean => {
    const prev = gs();
    const res = signLicenseOffer(prev);
    if (!res.ok) { showToast(res.reason ?? "Can't sign that contract", { tone: "negative" }); return false; }
    haptic.success();
    sfx("cash");
    store.set(res.state);
    return true;
  }, []);
  const declineLicenseOfferCb = useCallback(() => {
    haptic.light();
    store.set((s) => declineLicenseOffer(s).state);
  }, []);
  // Push the inbound contract for a bigger bonus â€” a one-shot gamble. Returns the outcome (+ any bonus
  // won) so the popup can play the right reveal; applies whatever the deterministic engine decided.
  const negotiateLicenseOfferCb = useCallback((): { outcome: NegotiationOutcome; bonusDelta: Money } | null => {
    const res = negotiateLicenseOffer(gs());
    if (!res.ok || !res.negotiationOutcome) { showToast(res.reason ?? "Can't negotiate that", { tone: "negative" }); return null; }
    const outcome = res.negotiationOutcome;
    if (outcome === "improved") { haptic.success(); sfx("cash"); }
    else if (outcome === "walked") { haptic.error(); sfx("error"); }
    else { haptic.medium(); sfx("toggle"); }
    store.set(res.state);
    return { outcome, bonusDelta: res.negotiationBonusDelta ?? (0 as Money) };
  }, []);
  // Building an OS module spends RP (emit the spend FX) and can trip the Platform Pioneer / Walled
  // Garden milestones â€” fold + celebrate them here on the value-call path, not on the next tick.
  const installOsFeatureCb = useCallback((id: string) => {
    const prev = gs();
    const built = installOsFeature(prev, id);
    if (built === prev) return; // gated no-op (locked / unaffordable / already built)
    const rpSpent = prev.researchPoints - built.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    store.set(withLiveAchievements(built));
  }, []);
  const setOsPhilosophyCb = useCallback((id: string | null) => store.set((s) => setOsPhilosophy(s, id)), []);
  const placeFurnitureCb = useCallback((type: FurnitureId, c: number, r: number, rot: Rot) => store.set((s) => placeFurniture(s, type, c, r, rot)), []);
  const moveFurnitureCb = useCallback((iid: string, c: number, r: number) => store.set((s) => moveFurniture(s, iid, c, r)), []);
  const rotateFurnitureCb = useCallback((iid: string) => store.set((s) => rotateFurniture(s, iid)), []);
  const removeFurnitureCb = useCallback((iid: string) => store.set((s) => removeFurniture(s, iid)), []);
  const duplicateFurnitureCb = useCallback((iid: string) => store.set((s) => duplicateFurniture(s, iid)), []);
  const resetFurnitureCb = useCallback(() => store.set((s) => resetFurniture(s)), []);
  const setLayoutCb = useCallback((layout: PlacedItem[]) => store.set((s) => setLayout(s, layout)), []);
  const applyLayoutSnapshotCb = useCallback((snap: { layout: PlacedItem[]; cash: Money }) => store.set((s) => applyLayoutSnapshot(s, snap)), []);
  const applyFactorySnapshotCb = useCallback((snap: { floor: import("../engine/factoryFloor.ts").FactoryFloor; props: import("../engine/factoryProps.ts").PlacedProp[]; cash: Money }) => store.set((s) => applyFactorySnapshot(s, snap)), []);
  const setFloorStyleCb = useCallback((i: number) => store.set((s) => setFloorStyle(s, i)), []);
  const setTeamFocusCb = useCallback((focus: "research" | "build" | null) => store.set((s) => setTeamFocus(s, focus)), []);
  const setWallStyleCb = useCallback((i: number) => store.set((s) => setWallStyle(s, i)), []);
  const setFactoryDecorCb = useCallback((patch: Partial<{ wall: number; floor: number }>) => store.set((s) => setFactoryDecor(s, patch)), []);
  const buySharesCb = useCallback((id: string, qty: number) => {
    const prev = gs();
    const next = withLiveAchievements(buyShares(prev, id, qty));
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const sellSharesCb = useCallback((id: string, qty: number) => store.set((s) => sellShares(s, id, qty)), []);
  const boardNudgeCb = useCallback((id: string) => {
    const prev = gs();
    if (!canBoardNudge(prev, id)) { haptic.error(); return; }
    const comp = prev.competitors.find((c) => c.id === id);
    store.set(boardNudge(prev, id));
    haptic.success(); sfx("confirm");
    showToast(`Launch delayed â€” ${comp?.name ?? "rival"} slips their next ship`, { tone: "positive", glyph: <Landmark size={15} /> });
  }, []);
  const acquireRivalCb = useCallback((id: string): boolean => {
    const prev = gs();
    const base = acquireRival(prev, id);
    if (base === prev) return false; // not allowed (stale button) â€” caller skips the celebration
    const next = withLiveAchievements(base);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
    return true;
  }, []);
  const listCompanyCb = useCallback((stake: number) => store.set((s) => withLiveAchievements(listCompany(s, stake))), []);
  const sellOwnStakeCb = useCallback((pct: number) => store.set((s) => sellOwnStake(s, pct)), []);
  const cutProductPriceCb = useCallback((productId: string, newPrice: Money) => {
    const result = cutProductPrice(gs(), productId, newPrice);
    if (result.ok) store.set(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const marketingPushCb = useCallback((productId: string) => {
    const prev = gs();
    const result = marketingPush(prev, productId);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const investBrandAwarenessCb = useCallback((points: number) => {
    const prev = gs();
    const result = investBrandAwareness(prev, points);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      sfx("cash"); haptic.success();
      store.set(result.state);
    } else if (result.reason) showToast(result.reason, { tone: "negative" });
    return { ok: result.ok, reason: result.reason };
  }, []);
  const restockProductCb = useCallback((productId: string, units: number) => {
    const prev = gs();
    const result = restockProduct(prev, productId, units);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const setReorderRateCb = useCallback((productId: string, rate: number) => {
    const result = setReorderRate(gs(), productId, rate);
    if (result.ok) store.set(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const harvestProductCb = useCallback((productId: string) => {
    const result = harvestProduct(gs(), productId);
    if (result.ok) store.set(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const buyFloorMachineCb = useCallback((kind: import("../engine/factoryFloor.ts").MachineKind, c: number, r: number) => {
    const prev = gs();
    const result = buyFloorMachine(prev, kind, c, r);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const buyFloorBeltCb = useCallback((c: number, r: number, dir: import("../engine/factoryFloor.ts").BeltDir) => {
    const prev = gs();
    const result = buyFloorBelt(prev, c, r, dir);
    if (result.ok) store.set(result.state); // belt cost is tiny; skip the spend float spam
    return { ok: result.ok, reason: result.reason };
  }, []);
  const paintBeltRunCb = useCallback((cells: { c: number; r: number }[], dir: import("../engine/factoryFloor.ts").BeltDir) => {
    const prev = gs();
    const result = paintBeltRun(prev, cells, dir);
    if (result.ok) store.set(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const buyFactoryPropCb = useCallback((kind: import("../engine/factoryProps.ts").PropKind, c: number, r: number) => {
    const prev = gs();
    const result = buyFactoryProp(prev, kind, c, r);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const buyFloorExpansionCb = useCallback(() => {
    const prev = gs();
    const result = buyFloorExpansion(prev);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const clearFloorCellCb = useCallback((c: number, r: number) => store.set((st) => clearFloorCell(st, c, r)), []);
  const upgradeFloorMachineCb = useCallback((c: number, r: number) => {
    const prev = gs();
    const result = upgradeFloorMachine(prev, c, r);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const moveFloorMachineCb = useCallback((id: string, c: number, r: number) => {
    const result = moveFloorMachine(gs(), id, c, r);
    if (result.ok) store.set(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const moveFactoryPropCb = useCallback((id: string, c: number, r: number) => {
    const result = moveFactoryProp(gs(), id, c, r);
    if (result.ok) store.set(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const autoConnectLineCb = useCallback(() => {
    const prev = gs();
    const result = autoConnectLine(prev);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const saveFactoryLayoutCb = useCallback((name: string) => {
    const result = saveFactoryLayout(gs(), name);
    if (result.ok) store.set(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const applyFactoryLayoutCb = useCallback((id: string) => {
    const prev = gs();
    const result = applyFactoryLayout(prev, id);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money; // negative when the retool nets a refund
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const deleteFactoryLayoutCb = useCallback((id: string) => store.set((st) => deleteFactoryLayout(st, id)), []);
  const rushBuildCb = useCallback((productId: string) => {
    const prev = gs();
    const result = rushBuild(prev, productId);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      store.set(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const giveRaiseCb = useCallback((id: string) => store.set((s) => giveRaise(s, id)), []);
  const resolveChoiceCb = useCallback((optionId: string) => store.set((s) => resolveChoice(s, optionId)), []);
  // These three can lower cash, so they route the drop through emitSpend like build/hire/upgrade do
  // (consistent spend feedback). takeLoan ADDS cash, so it stays a plain setState.
  const spendThrough = useCallback((next: GameState) => {
    const spent = (gs().cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    store.set(next);
  }, []);
  const resolvePoachCb = useCallback((accept: boolean) => spendThrough(resolvePoach(gs(), accept)), [spendThrough]);
  const takeLoanCb = useCallback((principalCents: number) => store.set((s) => takeLoan(s, principalCents)), []);
  const repayLoanCb = useCallback((id: string) => spendThrough(repayLoan(gs(), id)), [spendThrough]);
  const boostMoraleCb = useCallback((kind: MoraleKind) => spendThrough(boostMorale(gs(), kind)), [spendThrough]);

  // Before a challenge/scenario takes over the main save slot, stash the player's real freeform
  // company so it survives and can be restored with returnHome(). Only stashes a FREEFORM run (never
  // a challenge/scenario) so starting a second side-run from within one can't clobber the real
  // company that's already held. No-op (and leaves any existing stash intact) otherwise.
  const stashHomeIfFreeform = useCallback((): boolean => {
    const cur = gs();
    if (cur.onboarded && !cur.activeChallenge && !cur.activeScenario) {
      // Verify the stash actually landed before the caller clears the save â€” a swallowed quota
      // failure here would let clearSave() destroy an unrecoverable freeform company.
      const ok = stashHomeSave(cur);
      if (ok) setHomeSaved(true);
      return ok;
    }
    return true; // nothing freeform to protect (fresh start, or already in a side run)
  }, []);

  /** Rewind to a Time Machine snapshot. Deliberately routed through the same path as a save import:
   *  the snapshot is validated by the loader's own migrate, then written and adopted as the live
   *  company. Fails closed â€” a missing or unreadable snapshot leaves the running game untouched. */
  const rewindTo = useCallback((snapshotId: string) => {
    // Two refusals before anything is written. A scenario or challenge run occupies the MAIN save
    // slot while the player's real company sits in the home stash â€” restoring a campaign snapshot
    // over it would silently destroy the scored run and leave the stash orphaned. And a blocked tab
    // must not write at all: the single-writer guard exists so two windows can't clobber each other,
    // and this direct save() would drive straight through it.
    const current = gs();
    if (tabBlocked || current.activeScenario != null || current.activeChallenge != null) return false;

    const restored = restoreSnapshot(snapshotId);
    if (!restored) return false;
    const next: GameState = { ...withValidatedSandbox(restored), lastActive: Date.now() };
    seedFeedSeq(next); // keep the feed-id counter above the restored ids
    save(next);
    store.set(next);
    setPaused(true); // land the player paused on the rewound week rather than mid-tick
    setFast(false);
    setSkipping(false);
    return true;
  }, [tabBlocked]);

  const restart = useCallback(() => {
    mergeProfileAchievements(gs().unlockedAchievements); // preserve this company's milestones for good
    clearSave();
    clearSnapshots(); // same reason as prestige: no rewinding into an abandoned company
    // A deliberate fresh start abandons any held side-trip context too, so a new company never shows a
    // stale "return to your company" pointing at a company the player chose to leave behind.
    clearHomeSave();
    setHomeSaved(false);
    // Platform is an entitlement, not run progress, so it stays across a fresh company. The lifetime
    // "seen dilemmas" set carries across too (as it does in prestige), so a restart surfaces fresh
    // decisions first instead of re-asking ones the player already resolved.
    store.set(withInterruptPace({ ...newGame(undefined, getLegacy()), platformUnlocked: gs().platformUnlocked, seenChoices: gs().seenChoices }));
    setPaused(false);
    setFast(false); // F37 â€” a fresh company must not inherit fast-forward speed.
    setSkipping(false);
  }, []);

  // Scenarios are a level playing field: they deliberately do NOT inherit the prestige legacy bonus
  // (that would break each scenario's hand-authored start, e.g. Bootstrapped's tight cash). The
  // start values come entirely from the scenario's setup. The freeform company is stashed first so
  // it's preserved (returnHome restores it) instead of destroyed.
  const startScenario = useCallback((id: string, name?: string) => {
    // Item 5.1 â€” enforce the campaign chain: a locked scenario can't be started even if a stale UI
    // slips through. Total stars come from the profile store.
    const sc = scenarioById(id);
    if (sc) {
      const stars = getScenarioStars();
      const total = Object.values(stars).reduce((a, b) => a + (b ?? 0), 0);
      if (!scenarioUnlocked(sc, total)) {
        showToast(`Locked â€” earn ${scenarioUnlockStars(sc)}â˜… across the scenarios to unlock this one.`, { tone: "negative" });
        return;
      }
    }
    // Park the freeform company FIRST; if the stash can't land (quota), abort instead of clearing the
    // save out from under an unrecoverable company.
    if (!stashHomeIfFreeform()) {
      showToast("Couldn't free up storage to park your company â€” scenario cancelled to keep it safe.", { tone: "negative" });
      return;
    }
    mergeProfileAchievements(gs().unlockedAchievements); // keep this run's milestones
    clearSave();
    store.set({ ...newScenarioGame(id, undefined, undefined, name), platformUnlocked: gs().platformUnlocked });
    setPaused(false);
    setFast(false);
    setSkipping(false);
  }, [stashHomeIfFreeform]);

  // Daily/weekly challenge: a flavored run seeded from today's (UTC) date. Like scenarios, this takes
  // over the main slot â€” but the freeform company is stashed first (returnHome restores it), so a
  // challenge is a side trip you can leave, not a company-wipe. The per-date best lives in the profile.
  const startChallenge = useCallback((kind: ChallengeKind, dateKey?: string): boolean => {
    const dk = dateKey ?? dateKeyOf(new Date());
    // One-attempt lock (REVIEW_FINDINGS P2): a date's challenge is one shot — starting it consumes
    // the attempt, and a recorded best from before the lock existed counts as an attempt too.
    const key = challengeKey(kind, dk);
    if (hasAttemptedChallenge(key)) {
      showToast(`Already attempted — each ${kind} challenge is one shot. ${kind === "weekly" ? "A new one arrives next week." : "A new one arrives tomorrow."}`, { tone: "negative" });
      return false;
    }
    if (!stashHomeIfFreeform()) {
      showToast("Couldn't free up storage to park your company â€” challenge cancelled to keep it safe.", { tone: "negative" });
      return false;
    }
    mergeProfileAchievements(gs().unlockedAchievements); // keep this run's milestones
    clearSave();
    store.set({ ...newChallengeGame(kind, dk), platformUnlocked: gs().platformUnlocked });
    recordChallengeAttempt(key); // stamp AFTER the run actually started, so an aborted stash doesn't burn the day
    setPaused(false);
    setFast(false);
    setSkipping(false);
    return true;
  }, [stashHomeIfFreeform]);

  // Leave the current challenge/scenario and restore the stashed freeform company to the main slot.
  // The held company resumes exactly where it was parked â€” time does NOT advance for the weeks spent
  // in the side run (lastActive is re-anchored to now, like a paused-then-resumed session), so a
  // challenge can never bankrupt or age the real company. No-op if nothing is stashed.
  const returnHome = useCallback(() => {
    const home = readHomeSave();
    if (!home) return false;
    clearHomeSave();
    setHomeSaved(false);
    const restored: GameState = { ...home, lastActive: Date.now() };
    save(restored); // reclaim the main slot from the challenge run
    store.set(restored);
    setPaused(false);
    setFast(false);
    setSkipping(false);
    return true;
  }, []);

  // All callbacks below are ref-stable (useCallback []/setState setters), so this object is built
  // once and keeps a stable identity. Co-locating the action list here replaces the old 60-entry
  // hand-maintained dep array on `value` â€” which had silently drifted (4 callbacks were missing) â€”
  // with a small, exhaustive-deps-checkable list, and lets the hot `value` memo depend on just the
  // data slice. (Per-tick re-renders are unchanged: every consumer reads `state`, and the costly 3D
  // child is already React.memo'd â€” this is a correctness/maintainability fix, not a perf change.)
  const actions = useMemo<GameActionsValue>(
    () => ({
      setPaused,
      setFast,
      setSkipping,
      pushSuspend,
      popSuspend,
      takeOverHere,
      build,
      launchReady: launchReadyCb,
      research,
      cancelResearch: cancelResearchCb,
      cancelQueuedResearch: cancelQueuedResearchCb,
      unlockLens: unlockLensCb,
      unlockFinish: unlockFinishCb,
      buyProject: buyProjectCb,
      hostKeynote: hostKeynoteCb,
      attemptMoonshot: attemptMoonshotCb,
      announceKeynote: announceKeynoteCb,
      resolveStrike: resolveStrikeCb,
      collectAwards: collectAwardsCb,
      dismissRivalry: dismissRivalryCb,
      dismissNemesisTrophy: dismissNemesisTrophyCb,
      investigateSecret: investigateSecretCb,
      markVaultSeen: markVaultSeenCb,
      dismissSecretReveal: dismissSecretRevealCb,
      resolveEureka: resolveEurekaCb,
      resolveCommunityAsk: resolveCommunityAskCb,
      resolveStaffMoment: resolveStaffMomentCb,
      resolveStaffEvent: resolveStaffEventCb,
      resolvePostLaunch: resolvePostLaunchCb,
      resolveRegionalEvent: resolveRegionalEventCb,
      buybackShares: buybackSharesCb,
      resolveEarnings: resolveEarningsCb,
      acceptSideOrder: acceptSideOrderCb,
      claimContract: claimContractCb,
      fundMegaproject: fundMegaprojectCb,
      buyLegacyPerk: buyLegacyPerkCb,
      buyFrontierTier: buyFrontierTierCb,
      declineSideOrder: declineSideOrderCb,
      cancelSideOrder: cancelSideOrderCb,
      buyUpgrade: buyUpgradeCb,
      unlockRegion: unlockRegionCb,
      acquireFactory: acquireFactoryCb,
      negotiateContract: negotiateContractCb,
      assign,
      train,
      hire,
      hireSpecialist: hireSpecialistCb,
      recruit,
      hireCandidate: hireCandidateCb,
      dismissCandidates,
      fire,
      upgradeHQ,
      advanceEra,
      chooseMandate,
      goPublic: goPublicCb,
      prestige,
      restart,
      startScenario,
      startChallenge,
      returnHome,
      markOnboarded,
      dismissTutorial,
      replayCoach,
      markUnlocksSeen,
      exportSave,
      importSave,
      rewindTo,
      setCompanyName: setCompanyNameCb,
      setSandboxActive,
      setInterruptPace: setInterruptPaceCb,
      setAutomation: setAutomationCb,
      setOsName: setOsNameCb,
      unlockPlatform: unlockPlatformCb,
      foundPlatform: foundPlatformCb,
      releaseOsVersion: releaseOsVersionCb,
      shipSecurityPatch: shipSecurityPatchCb,
      licenseOsToRival: licenseOsToRivalCb,
      revokeOsLicense: revokeOsLicenseCb,
      signLicenseOffer: signLicenseOfferCb,
      declineLicenseOffer: declineLicenseOfferCb,
      negotiateLicenseOffer: negotiateLicenseOfferCb,
      installOsFeature: installOsFeatureCb,
      setOsPhilosophy: setOsPhilosophyCb,
      placeFurniture: placeFurnitureCb,
      moveFurniture: moveFurnitureCb,
      rotateFurniture: rotateFurnitureCb,
      removeFurniture: removeFurnitureCb,
      duplicateFurniture: duplicateFurnitureCb,
      resetFurniture: resetFurnitureCb,
      setLayout: setLayoutCb,
      applyLayoutSnapshot: applyLayoutSnapshotCb,
      applyFactorySnapshot: applyFactorySnapshotCb,
      setFloorStyle: setFloorStyleCb,
      setWallStyle: setWallStyleCb,
      setFactoryDecor: setFactoryDecorCb,
      buyShares: buySharesCb,
      sellShares: sellSharesCb,
      acquireRival: acquireRivalCb,
      boardNudge: boardNudgeCb,
      listCompany: listCompanyCb,
      sellOwnStake: sellOwnStakeCb,
      cutProductPrice: cutProductPriceCb,
      marketingPush: marketingPushCb,
      investBrandAwareness: investBrandAwarenessCb,
      restockProduct: restockProductCb,
      setReorderRate: setReorderRateCb,
      harvestProduct: harvestProductCb,
      rushBuild: rushBuildCb,
      buyFloorMachine: buyFloorMachineCb,
      buyFloorBelt: buyFloorBeltCb,
      paintBeltRun: paintBeltRunCb,
      buyFactoryProp: buyFactoryPropCb,
      buyFloorExpansion: buyFloorExpansionCb,
      upgradeFloorMachine: upgradeFloorMachineCb,
      moveFloorMachine: moveFloorMachineCb,
      moveFactoryProp: moveFactoryPropCb,
      autoConnectLine: autoConnectLineCb,
      clearFloorCell: clearFloorCellCb,
      saveFactoryLayout: saveFactoryLayoutCb,
      applyFactoryLayout: applyFactoryLayoutCb,
      deleteFactoryLayout: deleteFactoryLayoutCb,
      giveRaise: giveRaiseCb,
      resolvePoach: resolvePoachCb,
      takeLoan: takeLoanCb,
      repayLoan: repayLoanCb,
      boostMorale: boostMoraleCb,
      setTeamFocus: setTeamFocusCb,
      rest,
      resolveChoice: resolveChoiceCb,
    }),
    [pushSuspend, popSuspend, takeOverHere, build, launchReadyCb, research, cancelResearchCb, cancelQueuedResearchCb, unlockLensCb, unlockFinishCb, buyProjectCb, hostKeynoteCb, attemptMoonshotCb, announceKeynoteCb, resolveStrikeCb, collectAwardsCb, dismissRivalryCb, dismissNemesisTrophyCb, investigateSecretCb, markVaultSeenCb, dismissSecretRevealCb, resolveEurekaCb, resolveCommunityAskCb, resolveStaffMomentCb, resolveStaffEventCb, resolvePostLaunchCb, resolveRegionalEventCb, buybackSharesCb, resolveEarningsCb, acceptSideOrderCb, claimContractCb, fundMegaprojectCb, buyLegacyPerkCb, buyFrontierTierCb, declineSideOrderCb, cancelSideOrderCb, buyUpgradeCb, unlockRegionCb, acquireFactoryCb, negotiateContractCb, assign, train, hire, hireSpecialistCb, recruit, hireCandidateCb, dismissCandidates, fire, upgradeHQ, advanceEra, chooseMandate, goPublicCb, prestige, restart, startScenario, startChallenge, returnHome, markOnboarded, dismissTutorial, replayCoach, markUnlocksSeen, exportSave, importSave, setCompanyNameCb, setSandboxActive, setInterruptPaceCb, setAutomationCb, setOsNameCb, unlockPlatformCb, foundPlatformCb, releaseOsVersionCb, shipSecurityPatchCb, licenseOsToRivalCb, revokeOsLicenseCb, signLicenseOfferCb, declineLicenseOfferCb, negotiateLicenseOfferCb, installOsFeatureCb, setOsPhilosophyCb, placeFurnitureCb, moveFurnitureCb, rotateFurnitureCb, removeFurnitureCb, duplicateFurnitureCb, resetFurnitureCb, setLayoutCb, applyLayoutSnapshotCb, applyFactorySnapshotCb, setFloorStyleCb, setWallStyleCb, setFactoryDecorCb, buySharesCb, sellSharesCb, acquireRivalCb, boardNudgeCb, listCompanyCb, sellOwnStakeCb, cutProductPriceCb, marketingPushCb, investBrandAwarenessCb, restockProductCb, setReorderRateCb, harvestProductCb, rushBuildCb, buyFloorMachineCb, buyFloorBeltCb, paintBeltRunCb, buyFactoryPropCb, buyFloorExpansionCb, upgradeFloorMachineCb, moveFloorMachineCb, moveFactoryPropCb, autoConnectLineCb, clearFloorCellCb, saveFactoryLayoutCb, applyFactoryLayoutCb, deleteFactoryLayoutCb, giveRaiseCb, rest, resolveChoiceCb, resolvePoachCb, takeLoanCb, repayLoanCb, boostMoraleCb, setTeamFocusCb],
  );

  // F36 — three contexts instead of one combined value. Controls change rarely (pace toggles,
  // overlay holds, side-run stashes); actions never change; the game state itself is NOT in a
  // context at all — consumers subscribe to the store through useGame/useGameSelector, so an
  // ordinary week re-renders only components that actually read live data.
  const controls = useMemo<GameControlsValue>(
    () => ({ paused, fast, skipping, tabBlocked, suspended, homeSaved }),
    [paused, fast, skipping, tabBlocked, suspended, homeSaved],
  );

  // Surface a tick crash as a render throw (see `tickError` above), so the ROOT ErrorBoundary in
  // App.tsx shows the copyable report + Reload + guarded Reset instead of the game silently freezing.
  // Deliberately AFTER every hook in this component: throwing earlier would skip the hooks below it
  // and leave React's hook list for this fiber inconsistent. Here the render is complete except for
  // the return, so the hook order is identical on the throwing render and every one before it.
  if (tickError) throw tickError;

  return (
    <StoreContext.Provider value={store}>
      <ActionsContext.Provider value={actions}>
        <ControlsContext.Provider value={controls}>{children}</ControlsContext.Provider>
      </ActionsContext.Provider>
    </StoreContext.Provider>
  );
}

/** Internal selector hook over a store instance: re-renders only when the SELECTED value changes.
 *  The selector/equality are held in refs so `getSnapshot` stays referentially stable across the
 *  caller's re-renders (useSyncExternalStore requires it), and the last result is cached so an
 *  unchanged selection returns the SAME object — object-returning selectors don't loop or spam
 *  renders. */
function useStoreSelector<T>(
  store: GameStore,
  selector: (s: GameState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const selRef = useRef(selector);
  selRef.current = selector;
  const eqRef = useRef(isEqual);
  eqRef.current = isEqual;
  const cacheRef = useRef<{ s: GameState; v: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const s = store.getState();
    const cached = cacheRef.current;
    if (cached && cached.s === s) return cached.v;
    const v = selRef.current(s);
    if (cached && eqRef.current(cached.v, v)) {
      cacheRef.current = { s, v: cached.v }; // same value → keep the old reference
      return cached.v;
    }
    cacheRef.current = { s, v };
    return v;
  }, [store]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribe to a SLICE of the game state. The component re-renders only when the selected value
 * changes (per `isEqual`, default Object.is) — not on every weekly tick. This is the F36 hot-path
 * hook: chrome and static cards select exactly the fields they gate on, while live-data widgets
 * keep full useGame() subscriptions.
 *
 * For object/array selections pass a stable isEqual (e.g. shallow) or select primitives.
 */
export function useGameSelector<T>(
  selector: (s: GameState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useGameSelector must be used within GameProvider");
  return useStoreSelector(store, selector, isEqual);
}

/** The rare-change control flags (paused/fast/skipping/tabBlocked/suspended/homeSaved). Never
 *  re-renders on the weekly tick — for progress rings, speed dials and run trackers that only care
 *  about pacing. */
export function useGameControls(): GameControlsValue {
  const ctx = useContext(ControlsContext);
  if (!ctx) throw new Error("useGameControls must be used within GameProvider");
  return ctx;
}

/** The stable action set. Identity never changes for the life of the provider, so action-only
 *  consumers (sheets, modals, dispatch rows) render once and stay quiet while the sim runs. */
export function useGameActions(): GameActionsValue {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useGameActions must be used within GameProvider");
  return ctx;
}

/** Back-compat full read: live state + controls + actions in one call. Re-renders on every weekly
 *  tick (it subscribes to the whole state) — prefer useGameSelector/useGameControls/useGameActions
 *  in new code, and convert hot paths to them. */
export function useGame(): GameContextValue {
  const store = useContext(StoreContext);
  const controls = useContext(ControlsContext);
  const actions = useContext(ActionsContext);
  if (!store || !controls || !actions) throw new Error("useGame must be used within GameProvider");
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { state, ...controls, ...actions };
}

/** Hold the simulation while an interrupt overlay is on screen. Pass the overlay's own `showing`
 *  flag: the sim is suspended (the weekly tick stops) while ANY caller holds it, and resumes only
 *  once every overlay has let go. This is the ONE way overlays should pause the world — it is
 *  ref-counted and per-overlay, so overlapping overlays stack cleanly and can never strand the sim
 *  paused (the failure mode of the old capture-and-restore-`paused` pattern). The user's manual
 *  Pause is a separate flag and is left untouched. */
export function useHoldSim(active: boolean): void {
  const { pushSuspend, popSuspend } = useGameActions();
  useEffect(() => {
    if (!active) return;
    pushSuspend();
    return popSuspend;
  }, [active, pushSuspend, popSuspend]);
}
