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
  type ReactNode,
} from "react";
import { BALANCE } from "../engine/balance.ts";
import { dollars, format, toDollars, type Money } from "../engine/money.ts";
import type { ComponentKind, FactoryId, Product, RecruitTier, RegionId, StaffRole, SupplierId } from "../engine/types.ts";
import type { ContractTerm } from "../engine/suppliers.ts";
import {
  advanceEraAction,
  advanceOneWeek,
  assignStaff,
  skipInterrupt,
  evaluateAndUnlock,
  evaluateObjectives,
  buyProject,
  hostKeynote,
  resolveStrike,
  collectAwards,
  acceptSideOrder,
  claimContract,
  declineSideOrder,
  cancelSideOrder,
  REV_MILESTONES,
  buyShares,
  acquireRival,
  buyUpgrade,
  buyDesktop,
  unlockRegion,
  acquireFactory,
  negotiateContract,
  cutProductPrice,
  marketingPush,
  restockProduct,
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
  catchUpOffline,
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
  moveFurniture,
  newGame,
  placeFurniture,
  removeFurniture,
  researchNext,
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
  installOsFeature,
  setOsPhilosophy,
  type GameState,
} from "./gameState.ts";
import { getLegacy, setLegacy } from "./legacy.ts";
import { recordStars, getScenarioStars, mergeScenarioStars } from "./scenarioProgress.ts";
import { recordChallengeBest, challengeKey, getChallengeBests, mergeChallengeBests } from "./challengeProgress.ts";
import { addMuseumEntry, getMuseum, mergeMuseum } from "./museum.ts";
import { getProfileAchievements, mergeProfileAchievements } from "./achievementsProfile.ts";
import { scenarioById, canEarnStars, SCENARIOS } from "../engine/scenarios.ts";
import type { MasteryInput } from "../engine/achievements.ts";
import { dateKeyOf, formatScore, type ChallengeKind } from "../engine/challenges.ts";
import type { Assignment } from "../engine/types.ts";
import type { ProjectId } from "../engine/research.ts";
import type { StrikeResponse } from "./gameState.ts";
import type { UpgradeId } from "../engine/upgrades.ts";
import type { ChannelId } from "../engine/marketing.ts";
import type { FurnitureId, PlacedItem, Rot } from "../engine/furniture.ts";
import { clearSave, exportSaveString, importSaveString, importProfileFromString, loadResult, save } from "./persistence.ts";
import { withValidatedSandbox } from "./entitlements.ts";
import { createTabGuard } from "./tabGuard.ts";
import { achievementById } from "../engine/achievements.ts";
import { objectiveById } from "../engine/objectives.ts";
import { achievementIcon } from "../design/achievementIcons.tsx";
import { CircleCheck } from "lucide-react";
import { showToast } from "../design/toast.tsx";
import { emitSpend, emitRpSpend } from "../design/spendFx.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { sfx } from "../design/sound.ts";
import { haptic } from "../design/haptics.ts";
import { projectById } from "../engine/research.ts";
import { createElement } from "react";

export interface OfflineSummary {
  weeks: number;
  gain: Money;
  /** The product that sold the most units while the player was away — a recap highlight. */
  topProduct: { name: string; units: number } | null;
}

/** The product whose unit sales grew the most across the offline window. Pure diff of the
 *  pre/post catch-up states; null if nothing sold while away. */
function topSellerWhileAway(before: GameState, after: GameState): { name: string; units: number } | null {
  const prev = new Map(before.launched.map((lp) => [lp.product.id, lp.unitsSold]));
  let best: { name: string; units: number } | null = null;
  for (const lp of after.launched) {
    const delta = lp.unitsSold - (prev.get(lp.product.id) ?? 0);
    if (delta > 0 && (!best || delta > best.units)) best = { name: lp.product.name, units: delta };
  }
  return best;
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

/** Fire a celebratory toast when the fan count crosses a milestone. */
function withFanToasts(prev: GameState, next: GameState): void {
  for (const m of FAN_TOAST_THRESHOLDS) {
    if (prev.fans < m && next.fans >= m) {
      try {
        showToast(`${fmtFans(m)} fans, your brand is growing!`, { tone: "positive" });
      } catch { /* toast host not mounted */ }
    }
  }
}

/** Fire a toast when any staff member gains a skill level during the live tick. */
function withStaffLevelToasts(prev: GameState, next: GameState): void {
  for (const ns of next.staff) {
    const ps = prev.staff.find((s) => s.id === ns.id);
    if (ps && ns.skill > ps.skill) {
      try {
        showToast(`${ns.name} reached Skill ${ns.skill}`, { tone: "positive" });
      } catch { /* toast host not mounted */ }
    }
  }
}

/** Fire a summary toast when a product finishes its sales run this tick. */
function withProductFinishToasts(prev: GameState, next: GameState): void {
  for (const nlp of next.launched) {
    if (nlp.weeksElapsed < nlp.weeklyUnits.length) continue; // still selling
    const plp = prev.launched.find((lp) => lp.product.id === nlp.product.id);
    if (!plp || plp.weeksElapsed >= plp.weeklyUnits.length) continue; // wasn't selling last tick either
    const v = nlp.verdict ?? "steady";
    const tone = v === "hit" || v === "solid" ? "positive" : v === "flop" ? "negative" : "neutral";
    try {
      showToast(
        `${nlp.product.name} finished its run, ${nlp.unitsSold.toLocaleString()} units · ${format(nlp.revenueToDate)}`,
        { tone },
      );
    } catch { /* toast host not mounted */ }
  }
}

/** Fire celebratory toasts for any revenue milestones crossed between prev and next. */
function withRevToasts(prev: GameState, next: GameState): void {
  const prevD = toDollars(prev.cumulativeRevenue);
  const nextD = toDollars(next.cumulativeRevenue);
  for (const m of REV_MILESTONES) {
    if (prevD < m && nextD >= m) {
      try {
        showToast(`Revenue milestone, ${fmtMilestone(m)} earned lifetime!`, { tone: "positive" });
      } catch { /* toast host not mounted */ }
    }
  }
}

/** Announce newly-unlocked achievements. Two polish rules (Phase 1, item 5):
 *  - Let the triggering action's own toast (e.g. the launch verdict) land FIRST — achievements
 *    are the secondary beat — by deferring this slightly.
 *  - Collapse a burst of simultaneous unlocks into ONE toast, so a single action (like a first
 *    launch that trips several milestones at once) can't bury the screen under a stack. */
function announceAchievements(unlocked: readonly string[]): void {
  const earned = unlocked
    .map((id) => achievementById(id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  if (earned.length === 0) return;
  const fire = () => {
    try {
      // A milestone deserves more than silent text — same weight as scenario stars.
      sfx("mastery");
      haptic.success();
      if (earned.length === 1) {
        const a = earned[0];
        showToast(`Achievement unlocked, ${a.title}`, {
          tone: "positive",
          glyph: createElement(achievementIcon(a.icon), { size: 15 }),
        });
      } else {
        const names = earned.slice(0, 2).map((a) => a.title).join(" · ");
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

/** Announce newly-completed "Next Move" objectives — the soft "goal done, here's the next one"
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
 * actions with a PRECOMPUTED state value — never from inside a setState updater (React invokes
 * updaters more than once under StrictMode, which would double-fire the toasts; the tick gates
 * its announcements per week instead) — and never the boot or offline-catch-up paths, which fold
 * unlocks in SILENTLY (evaluateAndUnlock without toasts) so a returning/away player is never
 * spammed with a backlog of celebrations.
 */
/** Cross-run mastery counts for the achievement evaluator, read from the profile stores (which the
 *  pure engine can't reach). Cheap — a couple of small JSON reads; called only on the once-per-week
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
 *  gate (recordStars is idempotent — it writes only on improvement — so a StrictMode double-invoke
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
  sfx("mastery");
  const name = scenarioById(state.activeScenario)?.name ?? "Scenario";
  setTimeout(() => {
    try {
      showToast(`${best}★ earned, ${name}`, {
        tone: "positive",
        glyph: createElement(achievementIcon("Star"), { size: 15 }),
      });
    } catch {
      /* toast host not mounted (e.g. tests) */
    }
  }, 800);
}

/** Record a completed challenge's score into the profile store (idempotent — only writes on a new
 *  best). When `announce` and the score just locked this tick (prev had none), celebrate once. */
function syncChallengeBest(prev: GameState, next: GameState, announce: boolean): void {
  const ch = next.activeChallenge;
  if (!ch || next.challengeScore == null) return;
  const { improved, best } = recordChallengeBest(challengeKey(ch.kind, ch.dateKey), next.challengeScore);
  if (!announce || prev.challengeScore != null) return; // only on the locking transition
  sfx("mastery");
  const label = ch.kind === "weekly" ? "Weekly challenge" : "Daily challenge";
  const scored = formatScore(ch.scoreMetric, next.challengeScore);
  const tail = improved ? ", new best!" : ` · best ${formatScore(ch.scoreMetric, best)}`;
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
}

/** The per-tick DATA slice of the context — changes whenever the sim advances. */
interface GameStateValue {
  state: GameState;
  paused: boolean;
  fast: boolean;
  skipping: boolean;
  offline: OfflineSummary | null;
  /** True when ANOTHER tab/window took over this save — this tab is frozen (no tick, no saves). */
  tabBlocked: boolean;
}

/** The ACTIONS slice — every callback. All entries are ref-stable for the life of the provider, so
 *  this object keeps a stable identity (see the `actions` memo); it is the single home for the
 *  action list, replacing the old hand-maintained 60-entry dep array that had already drifted. */
interface GameActionsValue {
  setPaused: (p: boolean) => void;
  setFast: (f: boolean) => void;
  setSkipping: (v: boolean) => void;
  clearOffline: () => void;
  /** Reload this tab so it boots from the freshest save and claims play back. */
  takeOverHere: () => void;
  build: (product: Product, plannedUnits?: number, channelId?: ChannelId) => { ok: boolean; reason?: string };
  launchReady: (productId: string) => { ok: boolean; reason?: string; launchScore?: number; verdict?: "hit" | "solid" | "flop" | "steady" };
  research: (kind: ComponentKind) => void;
  unlockLens: () => void;
  unlockFinish: () => void;
  buyProject: (id: ProjectId) => void;
  hostKeynote: () => void;
  resolveStrike: (choice: StrikeResponse) => void;
  collectAwards: () => void;
  acceptSideOrder: () => void;
  claimContract: (id: string) => void;
  declineSideOrder: () => void;
  cancelSideOrder: () => void;
  buyUpgrade: (id: UpgradeId) => void;
  buyDesktop: () => void;
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
  goPublic: () => void;
  prestige: () => void;
  restart: () => void;
  /** Begin a scenario run (overwrites the current save with the scenario's authored start). */
  startScenario: (id: string) => void;
  /** Begin a daily/weekly challenge (overwrites the current save). Defaults to today; pass a
   *  dateKey to play a specific (e.g. shared-by-code or historical) challenge. */
  startChallenge: (kind: ChallengeKind, dateKey?: string) => void;
  markOnboarded: () => void;
  dismissTutorial: () => void;
  // save export / import (offline backup)
  exportSave: () => string;
  importSave: (str: string) => boolean;
  setCompanyName: (name: string) => void;
  setSandboxActive: (on: boolean) => void;
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
  setFloorStyle: (i: number) => void;
  setWallStyle: (i: number) => void;
  setFactoryDecor: (patch: Partial<{ wall: number; floor: number }>) => void;
  // equity / stock market
  buyShares: (id: string, qty: number) => void;
  sellShares: (id: string, qty: number) => void;
  acquireRival: (id: string) => boolean;
  listCompany: (stake: number) => void;
  sellOwnStake: (pct: number) => void;
  cutProductPrice: (productId: string, newPrice: Money) => { ok: boolean; reason?: string };
  marketingPush: (productId: string) => { ok: boolean; reason?: string };
  restockProduct: (productId: string, units: number) => { ok: boolean; reason?: string };
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
}

/** Full context shape — data + actions. `useGame()` returns this (back-compat). */
type GameContextValue = GameStateValue & GameActionsValue;

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  // F1 — perform offline catch-up EXACTLY ONCE, here in the lazy initializer, and capture the
  // {state, weeks, gain} from that single run. The old code ALSO re-ran load()+catchUpOffline in a
  // mount effect against the still-stale on-disk lastActive, so offline gains applied twice (x4
  // under StrictMode), corrupting cash + determinism. We compute the summary here and save()
  // immediately so lastActive persists and can never be re-applied by a later load.
  const boot = useMemo(() => {
    const res = loadResult();
    if (res.status !== "ok") {
      // ABSENT or UNREADABLE → start fresh. On UNREADABLE the raw save was already copied to a
      // backup key inside loadResult(), so the player's data is preserved, not destroyed.
      return { state: newGame(undefined, getLegacy()), offline: null as OfflineSummary | null };
    }
    // Honor sandboxUnlocked only when the device actually owns the IAP — an imported or older
    // localStorage save could otherwise unlock the unlimited-cash floor for free.
    const loaded = withValidatedSandbox(res.state);
    // F4 — seed the feed-id counter above restored ids BEFORE any new feed item is generated.
    seedFeedSeq(loaded);
    // The company doesn't exist until the player founds it: a save written at the onboarding
    // name screen must not accrue offline weeks (rent/trends would erode an unstarted game).
    if (!loaded.onboarded || loaded.bankrupt) return { state: loaded, offline: null as OfflineSummary | null };
    const fansBefore = loaded.fans;
    const { state: caught, weeks, gain } = catchUpOffline(loaded);
    // F7 — don't punish a player for being away: pure weekly fan decay over the offline window
    // (up to 8 weeks of erosion they couldn't react to) is floored at the pre-catchup value.
    // Online weekly decay in advanceOneWeek is untouched.
    const floored: GameState = { ...caught, fans: Math.max(caught.fans, fansBefore) };
    // Fold in any achievements earned while away SILENTLY (no toast backlog on return). migrate()
    // already backfilled the on-disk earned set; this catches milestones crossed during catch-up.
    // Record a challenge whose scoreWeek was crossed while away FIRST (silently), so readMasteryInput
    // below counts it — otherwise challenges-10 would lag a cycle behind the completion.
    const scored = withScenarioRunStars(withChallengeScore(floored));
    syncChallengeBest(floored, scored, false);
    const withAch = evaluateAndUnlock(scored, readMasteryInput()).state;
    // Latch any objectives completed while away SILENTLY too, so the first live tick doesn't fire a
    // backlog of "goal complete" toasts on return.
    const withProgress = evaluateObjectives(withAch).state;
    mergeProfileAchievements(withProgress.unlockedAchievements); // capture the loaded run's full set (+ pre-profile saves)
    // Persist immediately so lastActive advances on disk (prevents any re-application of gains).
    save({ ...withProgress, lastActive: Date.now() });
    const topProduct = weeks > 0 ? topSellerWhileAway(loaded, withProgress) : null;
    return { state: withProgress, offline: weeks > 0 ? { weeks, gain, topProduct } : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<GameState>(boot.state);
  const [paused, setPaused] = useState(false);
  // Mirror `paused` into a ref so the visibility handler (bound once, [] deps) can read the live
  // value — a background→foreground resume must NOT catch up wall-clock time while explicitly paused.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [fast, setFast] = useState(false);
  // "Skip to next decision" — run at Fast speed until a week produces something that needs the
  // player's input (skipInterrupt), then auto-pause with a one-line reason. Decision-paced time.
  const [skipping, setSkipping] = useState(false);
  const [offline, setOffline] = useState<OfflineSummary | null>(boot.offline);
  const [tabBlocked, setTabBlocked] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Save paths are mount-once effects; they read the live blocked flag through a ref.
  const tabBlockedRef = useRef(tabBlocked);
  tabBlockedRef.current = tabBlocked;
  // Sim pauses while the page/app is backgrounded so hidden wall-time is reconciled EXACTLY ONCE
  // on resume (below) instead of being partially simulated by a throttled interval (web) or lost
  // entirely while JS is suspended (iOS). WKWebView fires visibilitychange on iOS background, so
  // this one path covers web + the Capacitor app.
  const [hidden, setHidden] = useState(false);
  // The wall-clock we last stamped onto the save — the basis for resume catch-up (a hide always
  // persists first, so this is the moment the sim effectively stopped).
  const lastActiveRef = useRef(Date.now());
  // The exact state object last written, so the periodic safety-net save can skip when nothing
  // changed (advanceOneWeek + every action return a NEW object, so reference identity = "dirty").
  const lastSavedRef = useRef<GameState>(boot.state);
  const hiddenAtRef = useRef(0);

  // F1 — offline catch-up already ran exactly once in the initializer above; do NOT re-run it in
  // a mount effect (that re-applied gains against the stale on-disk lastActive, x4 under StrictMode).

  // Multi-tab single-writer guard: when another tab claims this save, freeze this one — the tick
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
  // React may invoke the setState updater more than once (StrictMode dev double-invoke, bail-out
  // re-runs), so the toast/announce side-effects inside it are gated to fire once per simulated
  // week — state changes (including achievement unlocks) still apply on every invocation.
  const announcedWeekRef = useRef(-1);
  useEffect(() => {
    if (paused || hidden || state.bankrupt || tabBlocked || !state.onboarded) return;
    const ms = (BALANCE.secondsPerTick / (fast || skipping ? BALANCE.fastMultiplier : 1)) * 1000;
    const id = setInterval(() => {
      setState((s) => {
        const next = withScenarioRunStars(withChallengeScore(advanceOneWeek(s)));
        const firstThisWeek = next.week !== announcedWeekRef.current;
        if (firstThisWeek) {
          announcedWeekRef.current = next.week; // claim the week first (StrictMode double-invoke guard)
          // Record this week's challenge best BEFORE mastery is read, so a challenge that locks
          // this tick is counted now (no one-cycle lag for challenges-10). Idempotent.
          syncChallengeBest(s, next, true);
          // Skip-to-next-decision: the week produced something that needs input → stop time and
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
          withRevToasts(s, next);
          withFanToasts(s, next);
          withStaffLevelToasts(s, next);
          withProductFinishToasts(s, next);
          announceAchievements(unlocked);
          mergeProfileAchievements(unlocked);
          announceObjectives(completed);
          announceScenarioStars(next);
          // A commission finishing is a payday — celebrate it from any tab.
          if ((next.sideOrdersCompleted ?? 0) > (s.sideOrdersCompleted ?? 0)) {
            sfx("cash");
            showToast("Commission delivered — payment banked", { tone: "positive" });
          }
          // A paid-for recruiter shortlist EXPIRES quietly — the arrival must not (the player
          // may be on any tab when the candidates land).
          if (next.candidates.length > 0 && s.candidates.length === 0) {
            sfx("confirm");
            showToast(`Your shortlist arrived — ${next.candidates.length} candidate${next.candidates.length > 1 ? "s" : ""} to interview`, { tone: "positive" });
          }
        }
        return out2;
      });
    }, ms);
    return () => clearInterval(id);
  }, [paused, hidden, fast, skipping, state.bankrupt, tabBlocked, state.onboarded]);

  // One write path for every persistence trigger below: skip while another tab owns the save,
  // and always stamp lastActive so offline catch-up measures time since the last write. The old
  // three inlined copies of this had already drifted once (the double-offline bug).
  const persistNow = useCallback(() => {
    if (tabBlockedRef.current) return;
    const snap = stateRef.current;
    const stamped = Date.now();
    save({ ...snap, lastActive: stamped });
    lastActiveRef.current = stamped;
    lastSavedRef.current = snap;
  }, []);

  // Persist shortly after the LAST state change (debounce), not on a blind timer: this closes the
  // crash-loss window after an action (build/hire/launch) to ≤1s and avoids re-serializing the full
  // state every few seconds when nothing changed.
  useEffect(() => {
    if (tabBlockedRef.current) return;
    const id = setTimeout(persistNow, 800);
    return () => clearTimeout(id);
  }, [state, persistNow]);

  // Safety net for the one case the debounce can starve — continuous Fast-mode ticks faster than
  // the debounce window. Only writes when the state actually changed since the last save.
  useEffect(() => {
    const id = setInterval(() => {
      if (stateRef.current !== lastSavedRef.current) persistNow();
    }, 10_000);
    return () => clearInterval(id);
  }, [persistNow]);

  // Reconcile elapsed real-time into the sim when returning to the foreground (warm-resume offline
  // catch-up). Mirrors the cold-boot path: catch up from the lastActive we stamped on hide, so a
  // long background gap is simulated exactly once here (the tick was paused while hidden) instead
  // of silently vanishing. Surfaces the "while you were away" sheet only for a real absence.
  const resumeFromBackground = useCallback(() => {
    if (tabBlockedRef.current) return;
    if (pausedRef.current) {
      // Explicitly paused → time is stopped. Discard the background gap (in memory AND on disk) so
      // neither this warm resume nor a later cold boot fast-forwards the paused-and-away period.
      const now = Date.now();
      lastActiveRef.current = now;
      const anchored = { ...stateRef.current, lastActive: now };
      save(anchored);
      lastSavedRef.current = anchored;
      return;
    }
    const base: GameState = { ...stateRef.current, lastActive: lastActiveRef.current };
    if (!base.onboarded || base.bankrupt) return;
    const fansBefore = base.fans;
    const { state: caught, weeks, gain } = catchUpOffline(base);
    if (weeks <= 0) return;
    // F7 — don't punish time away: floor fans at the pre-catchup value (online decay is untouched).
    const floored: GameState = { ...caught, fans: Math.max(caught.fans, fansBefore) };
    // Lock + record a challenge that finished while away BEFORE reading mastery input (so it counts).
    const scored = withScenarioRunStars(withChallengeScore(floored));
    syncChallengeBest(floored, scored, false);
    const withAch = evaluateAndUnlock(scored, readMasteryInput()).state;
    const withProgress = evaluateObjectives(withAch).state; // latch away-completed objectives silently
    mergeProfileAchievements(withProgress.unlockedAchievements); // capture the loaded run's full set (+ pre-profile saves)
    const stamped = Date.now();
    setState(withProgress);
    save({ ...withProgress, lastActive: stamped });
    lastActiveRef.current = stamped;
    lastSavedRef.current = withProgress;
    // Only interrupt with the recap sheet after a genuine absence — not a quick tab glance.
    if (Date.now() - hiddenAtRef.current >= 60_000) {
      setOffline({ weeks, gain, topProduct: topSellerWhileAway(base, withAch) });
    }
  }, []);

  // Pause the sim on hide (persisting lastActive first) and reconcile on show; also persist on exit.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        persistNow();
        setHidden(true);
      } else {
        setHidden(false);
        resumeFromBackground();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", persistNow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", persistNow);
    };
  }, [persistNow, resumeFromBackground]);

  const build = useCallback((product: Product, plannedUnits?: number, channelId?: ChannelId) => {
    const result = startBuild(stateRef.current, product, plannedUnits, channelId);
    if (result.ok) {
      const spent = (stateRef.current.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);

  const launchReadyCb = useCallback((productId: string) => {
    const result = launchReady(stateRef.current, productId);
    // A launch can immediately cross a milestone (first ship, a hit, a hit streak, a sellout) — so
    // evaluate + celebrate right here, not only on the next weekly tick.
    if (result.ok) {
      const next = withLiveAchievements(result.state);
      // Enshrine the freshly-shipped device in the permanent museum (newest is launched[0]).
      const lp = next.launched[0];
      if (lp) {
        addMuseumEntry({
          key: `${next.seed}-${lp.product.id}-${lp.launchedWeek}`,
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
      setState(next);
    }
    return { ok: result.ok, reason: result.reason, launchScore: result.launchScore, verdict: result.verdict };
  }, []);

  const research = useCallback((kind: ComponentKind) => {
    const prev = stateRef.current;
    const next = researchNext(prev, kind);
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) { emitRpSpend(rpSpent); sfx("confirm"); }
    setState(next);
  }, []);

  const unlockLensCb = useCallback(() => {
    const prev = stateRef.current;
    const next = unlockLens(prev);
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    setState(next);
  }, []);
  const unlockFinishCb = useCallback(() => {
    const prev = stateRef.current;
    const next = unlockFinish(prev);
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    setState(next);
  }, []);
  const buyProjectCb = useCallback((id: ProjectId) => {
    const prev = stateRef.current;
    const next = buyProject(prev, id);
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    // Breakthrough! A completed project is a real milestone — celebrate it.
    if (next.completedProjects.length > prev.completedProjects.length) {
      emitCelebrate();
      sfx("confirm");
      showToast(`Breakthrough, ${projectById(id).name}`, { tone: "positive" });
    }
    setState(next);
  }, []);
  const buyUpgradeCb = useCallback((id: UpgradeId) => {
    const prev = stateRef.current;
    const next = buyUpgrade(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const acceptSideOrderCb = useCallback(() => {
    const prev = stateRef.current;
    const res = acceptSideOrder(prev);
    if (!res.ok) { showToast(res.reason ?? "Can't take the order", { tone: "negative" }); return; }
    haptic.success();
    sfx("confirm");
    setState(res.state);
  }, []);
  const claimContractCb = useCallback((id: string) => {
    const prev = stateRef.current;
    const res = claimContract(prev, id);
    if (!res.ok) { haptic.error(); showToast(res.reason ?? "Not ready to claim", { tone: "negative" }); return; }
    haptic.success();
    sfx("cash");
    setState(res.state);
  }, []);
  const declineSideOrderCb = useCallback(() => {
    haptic.light();
    setState(declineSideOrder(stateRef.current));
  }, []);
  const cancelSideOrderCb = useCallback(() => {
    const prev = stateRef.current;
    const res = cancelSideOrder(prev);
    if (!res.ok) { showToast(res.reason ?? "Can't cancel right now", { tone: "negative" }); return; }
    const spent = (prev.cash - res.state.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(res.state);
  }, []);
  const collectAwardsCb = useCallback(() => {
    const prev = stateRef.current;
    const wins = prev.pendingAwards?.playerWins ?? 0;
    const next = collectAwards(prev);
    if (next === prev) return;
    if (wins > 0) {
      emitCelebrate();
      sfx("mastery");
      haptic.success();
    }
    setState(next);
  }, []);
  const resolveStrikeCb = useCallback((choice: StrikeResponse) => {
    const prev = stateRef.current;
    if (!prev.pendingStrike) return; // a second input (Escape + scrim in one frame) is a no-op, not an error
    const result = resolveStrike(prev, choice);
    if (!result.ok) {
      showToast(result.reason ?? "Can't do that right now", { tone: "negative" });
      return;
    }
    const spent = (prev.cash - result.state.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(result.state);
  }, []);
  const hostKeynoteCb = useCallback(() => {
    const prev = stateRef.current;
    const next = hostKeynote(prev);
    const rpSpent = prev.researchPoints - next.researchPoints;
    if (rpSpent > 0) {
      emitRpSpend(rpSpent);
      emitCelebrate();
      sfx("confirm");
      showToast(`Keynote! +${(next.fans - prev.fans).toLocaleString()} fans`, { tone: "positive" });
    }
    setState(next);
  }, []);
  const buyDesktopCb = useCallback(() => {
    const prev = stateRef.current;
    const next = buyDesktop(prev);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const unlockRegionCb = useCallback((id: RegionId) => {
    const prev = stateRef.current;
    const next = unlockRegion(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const acquireFactoryCb = useCallback((id: FactoryId) => {
    const prev = stateRef.current;
    const next = acquireFactory(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const negotiateContractCb = useCallback((supplierId: SupplierId, termId: ContractTerm["id"]) => {
    const prev = stateRef.current;
    const next = negotiateContract(prev, supplierId, termId);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const assign = useCallback((id: string, a: Assignment) => setState((s) => assignStaff(s, id, a)), []);
  const train = useCallback((id: string) => {
    const prev = stateRef.current;
    const next = trainStaff(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const rest = useCallback((id: string) => {
    const prev = stateRef.current;
    const next = restStaff(prev, id);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);

  const hire = useCallback((role: StaffRole, skill: number, name: string) => {
    const prev = stateRef.current;
    const next = hireStaff(prev, role, skill, name);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const hireSpecialistCb = useCallback((which: "autoAssign" | "autoResearch") => {
    const prev = stateRef.current;
    const next = hireSpecialist(prev, which);
    if (next === prev) return; // no-op (division not opened / at capacity) — no false confirmation
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    // A specialist joining unlocks delegation — a real moment, not a silent debit (matches hire).
    haptic.success();
    sfx("confirm");
    showToast(
      which === "autoResearch" ? "Lead Researcher hired — Auto-research unlocked" : "People Lead hired — Auto-assign unlocked",
      { tone: "positive" },
    );
    setState(next);
  }, []);
  const recruit = useCallback((tier: RecruitTier) => {
    const prev = stateRef.current;
    const next = startRecruitment(prev, tier);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const hireCandidateCb = useCallback((candidateId: string) => {
    const prev = stateRef.current;
    const next = hireCandidate(prev, candidateId);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const dismissCandidates = useCallback(() => setState((s) => clearCandidates(s)), []);

  const fire = useCallback((id: string) => setState((s) => fireStaff(s, id)), []);
  const upgradeHQ = useCallback(() => {
    const prev = stateRef.current;
    const next = upgradeFacility(prev);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  // These actions can immediately satisfy a milestone (reach the final era, IPO, the pinnacle), so
  // fold + celebrate achievements here rather than waiting for the next tick.
  const advanceEra = useCallback(() => setState((s) => withLiveAchievements(advanceEraAction(s))), []);
  const goPublicCb = useCallback(() => setState((s) => withLiveAchievements(goPublic(s))), []);
  const prestige = useCallback(() => {
    mergeProfileAchievements(stateRef.current.unlockedAchievements); // milestones earned this run persist into NG+
    const next = getLegacy() + 1;
    setLegacy(next);
    clearSave();
    // New Game+ players already know the ropes — skip onboarding + the first-build coach. The
    // lifetime "seen dilemmas" set carries across so the new run surfaces fresh decisions first.
    setState({ ...newGame(undefined, next), onboarded: true, tutorialDone: true, platformUnlocked: stateRef.current.platformUnlocked, seenChoices: stateRef.current.seenChoices });
    setOffline(null);
    setPaused(false);
    setFast(false); // F37 — New Game+ must not inherit fast-forward speed.
    setSkipping(false);
  }, []);
  // Serialize the live state PLUS profile-level progression (legacy, scenario stars, challenge
  // bests, museum) so a backup is complete and survives a device migration.
  const exportSave = useCallback(
    () => exportSaveString(stateRef.current, {
      legacy: getLegacy(),
      scenarioStars: getScenarioStars(),
      challengeBests: getChallengeBests(),
      museum: getMuseum(),
      achievements: getProfileAchievements(),
    }),
    [],
  );

  // Validate + apply an imported backup. Returns false (and changes nothing) on a bad string, so
  // the caller can surface a clear error. On success we set the migrated state immutably, stamp
  // lastActive (so offline catch-up doesn't fire on a fresh paste), and persist immediately.
  const importSave = useCallback((str: string) => {
    const migrated = importSaveString(str);
    if (!migrated) return false;
    // Restore profile-level progression from a v2 backup (merged, keeping the best — never a downgrade).
    const profile = importProfileFromString(str);
    if (profile) {
      if (typeof profile.legacy === "number" && profile.legacy > getLegacy()) setLegacy(profile.legacy);
      mergeScenarioStars(profile.scenarioStars);
      mergeChallengeBests(profile.challengeBests);
      mergeMuseum(profile.museum);
      mergeProfileAchievements(Array.isArray(profile.achievements) ? profile.achievements : undefined);
    }
    const next: GameState = { ...withValidatedSandbox(migrated), lastActive: Date.now() };
    seedFeedSeq(next); // keep feed-id counter above the imported ids
    save(next);
    setState(next);
    setOffline(null);
    setPaused(false);
    setFast(false);
    setSkipping(false);
    return true;
  }, []);

  const markOnboarded = useCallback(() => setState((s) => ({ ...s, onboarded: true })), []);
  const dismissTutorial = useCallback(() => setState((s) => ({ ...s, tutorialDone: true })), []);
  const setCompanyNameCb = useCallback((name: string) => setState((s) => setCompanyName(s, name)), []);
  // Toggle Sandbox / Creative mode ON or OFF for the current game. Ownership is enforced by the
  // caller (Settings only shows the toggle once the IAP entitlement is held).
  const setSandboxActive = useCallback((on: boolean) => setState((s) => setSandbox(s, on)), []);
  const setAutomationCb = useCallback((patch: Partial<GameState["automation"]>) => setState((s) => setAutomation(s, patch)), []);
  const setOsNameCb = useCallback((name: string) => setState((s) => setOsName(s, name)), []);
  const unlockPlatformCb = useCallback((on: boolean) => setState((s) => unlockPlatform(s, on)), []);
  // Found the OS division — a major cash reinvestment. Value-call path: emit the spend FX + fold
  // achievements (so any milestone the moment trips celebrates immediately).
  const foundPlatformCb = useCallback(() => {
    const prev = stateRef.current;
    const next = foundPlatform(prev);
    if (next === prev) return; // gated no-op (already founded / can't afford)
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(withLiveAchievements(next));
  }, []);
  const releaseOsVersionCb = useCallback(() => {
    setState((s) => {
      const next = withLiveAchievements(releaseOsVersion(s));
      if (next !== s) sfx("era");
      return next;
    });
  }, []);
  // Ship a security patch (the immersive "update" button). Returns true so the Platform screen can
  // fire its update animation; shows the cooldown reason as a toast when it's not ready yet.
  const shipSecurityPatchCb = useCallback((): boolean => {
    const res = shipSecurityPatch(stateRef.current);
    if (!res.ok) { showToast(res.reason ?? "Can't patch right now", { tone: "neutral" }); return false; }
    haptic.success();
    sfx("upgrade");
    setState(res.state);
    return true;
  }, []);
  const licenseOsToRivalCb = useCallback((rivalId: string) => setState((s) => licenseOsToRival(s, rivalId)), []);
  const revokeOsLicenseCb = useCallback((rivalId: string) => setState((s) => revokeOsLicense(s, rivalId)), []);
  // Sign the inbound contract: bank the signing bonus (spend FX in reverse — a gain), and return
  // true so the Platform screen can fire its signing celebration.
  const signLicenseOfferCb = useCallback((): boolean => {
    const prev = stateRef.current;
    const res = signLicenseOffer(prev);
    if (!res.ok) { showToast(res.reason ?? "Can't sign that contract", { tone: "negative" }); return false; }
    haptic.success();
    sfx("cash");
    setState(res.state);
    return true;
  }, []);
  const declineLicenseOfferCb = useCallback(() => {
    haptic.light();
    setState((s) => declineLicenseOffer(s).state);
  }, []);
  // Building an OS module spends RP (emit the spend FX) and can trip the Platform Pioneer / Walled
  // Garden milestones — fold + celebrate them here on the value-call path, not on the next tick.
  const installOsFeatureCb = useCallback((id: string) => {
    const prev = stateRef.current;
    const built = installOsFeature(prev, id);
    if (built === prev) return; // gated no-op (locked / unaffordable / already built)
    const rpSpent = prev.researchPoints - built.researchPoints;
    if (rpSpent > 0) emitRpSpend(rpSpent);
    setState(withLiveAchievements(built));
  }, []);
  const setOsPhilosophyCb = useCallback((id: string | null) => setState((s) => setOsPhilosophy(s, id)), []);
  const placeFurnitureCb = useCallback((type: FurnitureId, c: number, r: number, rot: Rot) => setState((s) => placeFurniture(s, type, c, r, rot)), []);
  const moveFurnitureCb = useCallback((iid: string, c: number, r: number) => setState((s) => moveFurniture(s, iid, c, r)), []);
  const rotateFurnitureCb = useCallback((iid: string) => setState((s) => rotateFurniture(s, iid)), []);
  const removeFurnitureCb = useCallback((iid: string) => setState((s) => removeFurniture(s, iid)), []);
  const duplicateFurnitureCb = useCallback((iid: string) => setState((s) => duplicateFurniture(s, iid)), []);
  const resetFurnitureCb = useCallback(() => setState((s) => resetFurniture(s)), []);
  const setLayoutCb = useCallback((layout: PlacedItem[]) => setState((s) => setLayout(s, layout)), []);
  const applyLayoutSnapshotCb = useCallback((snap: { layout: PlacedItem[]; cash: Money }) => setState((s) => applyLayoutSnapshot(s, snap)), []);
  const setFloorStyleCb = useCallback((i: number) => setState((s) => setFloorStyle(s, i)), []);
  const setWallStyleCb = useCallback((i: number) => setState((s) => setWallStyle(s, i)), []);
  const setFactoryDecorCb = useCallback((patch: Partial<{ wall: number; floor: number }>) => setState((s) => setFactoryDecor(s, patch)), []);
  const buySharesCb = useCallback((id: string, qty: number) => {
    const prev = stateRef.current;
    const next = withLiveAchievements(buyShares(prev, id, qty));
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const sellSharesCb = useCallback((id: string, qty: number) => setState((s) => sellShares(s, id, qty)), []);
  const acquireRivalCb = useCallback((id: string): boolean => {
    const prev = stateRef.current;
    const base = acquireRival(prev, id);
    if (base === prev) return false; // not allowed (stale button) — caller skips the celebration
    const next = withLiveAchievements(base);
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
    return true;
  }, []);
  const listCompanyCb = useCallback((stake: number) => setState((s) => withLiveAchievements(listCompany(s, stake))), []);
  const sellOwnStakeCb = useCallback((pct: number) => setState((s) => sellOwnStake(s, pct)), []);
  const cutProductPriceCb = useCallback((productId: string, newPrice: Money) => {
    const result = cutProductPrice(stateRef.current, productId, newPrice);
    if (result.ok) setState(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const marketingPushCb = useCallback((productId: string) => {
    const prev = stateRef.current;
    const result = marketingPush(prev, productId);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const restockProductCb = useCallback((productId: string, units: number) => {
    const prev = stateRef.current;
    const result = restockProduct(prev, productId, units);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const buyFloorMachineCb = useCallback((kind: import("../engine/factoryFloor.ts").MachineKind, c: number, r: number) => {
    const prev = stateRef.current;
    const result = buyFloorMachine(prev, kind, c, r);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const buyFloorBeltCb = useCallback((c: number, r: number, dir: import("../engine/factoryFloor.ts").BeltDir) => {
    const prev = stateRef.current;
    const result = buyFloorBelt(prev, c, r, dir);
    if (result.ok) setState(result.state); // belt cost is tiny; skip the spend float spam
    return { ok: result.ok, reason: result.reason };
  }, []);
  const paintBeltRunCb = useCallback((cells: { c: number; r: number }[], dir: import("../engine/factoryFloor.ts").BeltDir) => {
    const prev = stateRef.current;
    const result = paintBeltRun(prev, cells, dir);
    if (result.ok) setState(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const buyFactoryPropCb = useCallback((kind: import("../engine/factoryProps.ts").PropKind, c: number, r: number) => {
    const prev = stateRef.current;
    const result = buyFactoryProp(prev, kind, c, r);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const buyFloorExpansionCb = useCallback(() => {
    const prev = stateRef.current;
    const result = buyFloorExpansion(prev);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const clearFloorCellCb = useCallback((c: number, r: number) => setState((st) => clearFloorCell(st, c, r)), []);
  const upgradeFloorMachineCb = useCallback((c: number, r: number) => {
    const prev = stateRef.current;
    const result = upgradeFloorMachine(prev, c, r);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const moveFloorMachineCb = useCallback((id: string, c: number, r: number) => {
    const result = moveFloorMachine(stateRef.current, id, c, r);
    if (result.ok) setState(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const moveFactoryPropCb = useCallback((id: string, c: number, r: number) => {
    const result = moveFactoryProp(stateRef.current, id, c, r);
    if (result.ok) setState(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const autoConnectLineCb = useCallback(() => {
    const prev = stateRef.current;
    const result = autoConnectLine(prev);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const saveFactoryLayoutCb = useCallback((name: string) => {
    const result = saveFactoryLayout(stateRef.current, name);
    if (result.ok) setState(result.state);
    return { ok: result.ok, reason: result.reason };
  }, []);
  const applyFactoryLayoutCb = useCallback((id: string) => {
    const prev = stateRef.current;
    const result = applyFactoryLayout(prev, id);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money; // negative when the retool nets a refund
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const deleteFactoryLayoutCb = useCallback((id: string) => setState((st) => deleteFactoryLayout(st, id)), []);
  const rushBuildCb = useCallback((productId: string) => {
    const prev = stateRef.current;
    const result = rushBuild(prev, productId);
    if (result.ok) {
      const spent = (prev.cash - result.state.cash) as Money;
      if (spent > 0) emitSpend(spent);
      setState(result.state);
    }
    return { ok: result.ok, reason: result.reason };
  }, []);
  const giveRaiseCb = useCallback((id: string) => setState((s) => giveRaise(s, id)), []);
  const resolveChoiceCb = useCallback((optionId: string) => setState((s) => resolveChoice(s, optionId)), []);
  // These three can lower cash, so they route the drop through emitSpend like build/hire/upgrade do
  // (consistent spend feedback). takeLoan ADDS cash, so it stays a plain setState.
  const spendThrough = useCallback((next: GameState) => {
    const spent = (stateRef.current.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const resolvePoachCb = useCallback((accept: boolean) => spendThrough(resolvePoach(stateRef.current, accept)), [spendThrough]);
  const takeLoanCb = useCallback((principalCents: number) => setState((s) => takeLoan(s, principalCents)), []);
  const repayLoanCb = useCallback((id: string) => spendThrough(repayLoan(stateRef.current, id)), [spendThrough]);
  const boostMoraleCb = useCallback((kind: MoraleKind) => spendThrough(boostMorale(stateRef.current, kind)), [spendThrough]);

  const restart = useCallback(() => {
    mergeProfileAchievements(stateRef.current.unlockedAchievements); // preserve this company's milestones for good
    clearSave();
    // Platform is an entitlement, not run progress, so it stays across a fresh company. The lifetime
    // "seen dilemmas" set carries across too (as it does in prestige), so a restart surfaces fresh
    // decisions first instead of re-asking ones the player already resolved.
    setState({ ...newGame(undefined, getLegacy()), platformUnlocked: stateRef.current.platformUnlocked, seenChoices: stateRef.current.seenChoices });
    setOffline(null);
    setPaused(false);
    setFast(false); // F37 — a fresh company must not inherit fast-forward speed.
    setSkipping(false);
  }, []);

  // Scenarios are a level playing field: they deliberately do NOT inherit the prestige legacy bonus
  // (that would break each scenario's hand-authored start, e.g. Bootstrapped's tight cash). The
  // start values come entirely from the scenario's setup.
  const startScenario = useCallback((id: string) => {
    mergeProfileAchievements(stateRef.current.unlockedAchievements); // keep this run's milestones
    clearSave();
    setState({ ...newScenarioGame(id), platformUnlocked: stateRef.current.platformUnlocked });
    setOffline(null);
    setPaused(false);
    setFast(false);
    setSkipping(false);
  }, []);

  // Daily/weekly challenge: a flavored run seeded from today's (UTC) date. Like scenarios, this
  // overwrites the current save; the per-date personal best lives in the profile store.
  const startChallenge = useCallback((kind: ChallengeKind, dateKey?: string) => {
    mergeProfileAchievements(stateRef.current.unlockedAchievements); // keep this run's milestones
    clearSave();
    setState({ ...newChallengeGame(kind, dateKey ?? dateKeyOf(new Date())), platformUnlocked: stateRef.current.platformUnlocked });
    setOffline(null);
    setPaused(false);
    setFast(false);
    setSkipping(false);
  }, []);

  const clearOffline = useCallback(() => setOffline(null), []);

  // All callbacks below are ref-stable (useCallback []/setState setters), so this object is built
  // once and keeps a stable identity. Co-locating the action list here replaces the old 60-entry
  // hand-maintained dep array on `value` — which had silently drifted (4 callbacks were missing) —
  // with a small, exhaustive-deps-checkable list, and lets the hot `value` memo depend on just the
  // data slice. (Per-tick re-renders are unchanged: every consumer reads `state`, and the costly 3D
  // child is already React.memo'd — this is a correctness/maintainability fix, not a perf change.)
  const actions = useMemo<GameActionsValue>(
    () => ({
      setPaused,
      setFast,
      setSkipping,
      clearOffline,
      takeOverHere,
      build,
      launchReady: launchReadyCb,
      research,
      unlockLens: unlockLensCb,
      unlockFinish: unlockFinishCb,
      buyProject: buyProjectCb,
      hostKeynote: hostKeynoteCb,
      resolveStrike: resolveStrikeCb,
      collectAwards: collectAwardsCb,
      acceptSideOrder: acceptSideOrderCb,
      claimContract: claimContractCb,
      declineSideOrder: declineSideOrderCb,
      cancelSideOrder: cancelSideOrderCb,
      buyUpgrade: buyUpgradeCb,
      buyDesktop: buyDesktopCb,
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
      goPublic: goPublicCb,
      prestige,
      restart,
      startScenario,
      startChallenge,
      markOnboarded,
      dismissTutorial,
      exportSave,
      importSave,
      setCompanyName: setCompanyNameCb,
      setSandboxActive,
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
      setFloorStyle: setFloorStyleCb,
      setWallStyle: setWallStyleCb,
      setFactoryDecor: setFactoryDecorCb,
      buyShares: buySharesCb,
      sellShares: sellSharesCb,
      acquireRival: acquireRivalCb,
      listCompany: listCompanyCb,
      sellOwnStake: sellOwnStakeCb,
      cutProductPrice: cutProductPriceCb,
      marketingPush: marketingPushCb,
      restockProduct: restockProductCb,
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
      rest,
      resolveChoice: resolveChoiceCb,
    }),
    [clearOffline, takeOverHere, build, launchReadyCb, research, unlockLensCb, unlockFinishCb, buyProjectCb, hostKeynoteCb, resolveStrikeCb, collectAwardsCb, acceptSideOrderCb, claimContractCb, declineSideOrderCb, cancelSideOrderCb, buyUpgradeCb, buyDesktopCb, unlockRegionCb, acquireFactoryCb, negotiateContractCb, assign, train, hire, hireSpecialistCb, recruit, hireCandidateCb, dismissCandidates, fire, upgradeHQ, advanceEra, goPublicCb, prestige, restart, startScenario, startChallenge, markOnboarded, dismissTutorial, exportSave, importSave, setCompanyNameCb, setSandboxActive, setAutomationCb, setOsNameCb, unlockPlatformCb, foundPlatformCb, releaseOsVersionCb, shipSecurityPatchCb, licenseOsToRivalCb, revokeOsLicenseCb, signLicenseOfferCb, declineLicenseOfferCb, installOsFeatureCb, setOsPhilosophyCb, placeFurnitureCb, moveFurnitureCb, rotateFurnitureCb, removeFurnitureCb, duplicateFurnitureCb, resetFurnitureCb, setLayoutCb, applyLayoutSnapshotCb, setFloorStyleCb, setWallStyleCb, setFactoryDecorCb, buySharesCb, sellSharesCb, acquireRivalCb, listCompanyCb, sellOwnStakeCb, cutProductPriceCb, marketingPushCb, restockProductCb, rushBuildCb, buyFloorMachineCb, buyFloorBeltCb, paintBeltRunCb, buyFactoryPropCb, buyFloorExpansionCb, upgradeFloorMachineCb, moveFloorMachineCb, moveFactoryPropCb, autoConnectLineCb, clearFloorCellCb, saveFactoryLayoutCb, applyFactoryLayoutCb, deleteFactoryLayoutCb, giveRaiseCb, rest, resolveChoiceCb, resolvePoachCb, takeLoanCb, repayLoanCb, boostMoraleCb],
  );

  // Hot path: only the per-tick data slice + the stable actions object. The action list is no longer
  // duplicated here, so it can't drift out of sync again.
  const value = useMemo<GameContextValue>(
    () => ({ state, paused, fast, skipping, offline, tabBlocked, ...actions }),
    [state, paused, fast, skipping, offline, tabBlocked, actions],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
