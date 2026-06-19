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
import type { ComponentKind, Product, RecruitTier, StaffRole } from "../engine/types.ts";
import {
  advanceEraAction,
  advanceOneWeek,
  assignStaff,
  evaluateAndUnlock,
  buyProject,
  REV_MILESTONES,
  buyShares,
  buyUpgrade,
  buyDesktop,
  cutProductPrice,
  marketingPush,
  giveRaise,
  resolveChoice,
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
  setCompanyName,
  setFloorStyle,
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
  releaseOsVersion,
  licenseOsToRival,
  revokeOsLicense,
  type GameState,
} from "./gameState.ts";
import { getLegacy, setLegacy } from "./legacy.ts";
import { recordStars, getScenarioStars, mergeScenarioStars } from "./scenarioProgress.ts";
import { recordChallengeBest, challengeKey, getChallengeBests, mergeChallengeBests } from "./challengeProgress.ts";
import { addMuseumEntry, getMuseum, mergeMuseum } from "./museum.ts";
import { getProfileAchievements, mergeProfileAchievements } from "./achievementsProfile.ts";
import { scenarioById, canEarnStars } from "../engine/scenarios.ts";
import { dateKeyOf, formatScore, type ChallengeKind } from "../engine/challenges.ts";
import type { Assignment } from "../engine/types.ts";
import type { ProjectId } from "../engine/research.ts";
import type { UpgradeId } from "../engine/upgrades.ts";
import type { ChannelId } from "../engine/marketing.ts";
import type { FurnitureId, PlacedItem, Rot } from "../engine/furniture.ts";
import { clearSave, exportSaveString, importSaveString, importProfileFromString, loadResult, save } from "./persistence.ts";
import { withValidatedSandbox } from "./entitlements.ts";
import { createTabGuard } from "./tabGuard.ts";
import { achievementById } from "../engine/achievements.ts";
import { achievementIcon } from "../design/achievementIcons.tsx";
import { showToast } from "../design/toast.tsx";
import { emitSpend, emitRpSpend } from "../design/spendFx.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { sfx } from "../design/sound.ts";
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
        showToast(`${fmtFans(m)} fans — your brand is growing!`, { tone: "positive" });
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
        `${nlp.product.name} finished its run — ${nlp.unitsSold.toLocaleString()} units · ${format(nlp.revenueToDate)}`,
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
        showToast(`Revenue milestone — ${fmtMilestone(m)} earned lifetime!`, { tone: "positive" });
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
      if (earned.length === 1) {
        const a = earned[0];
        showToast(`Achievement unlocked — ${a.title}`, {
          tone: "positive",
          glyph: createElement(achievementIcon(a.icon), { size: 15 }),
        });
      } else {
        const names = earned.slice(0, 2).map((a) => a.title).join(" · ");
        const extra = earned.length > 2 ? ` +${earned.length - 2} more` : "";
        showToast(`${earned.length} milestones unlocked — ${names}${extra}`, {
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

/**
 * Fold achievement evaluation into a state transition during LIVE play. Marks newly-satisfied
 * milestones unlocked AND fires one celebratory toast per new unlock. Only ever called from live
 * actions with a PRECOMPUTED state value — never from inside a setState updater (React invokes
 * updaters more than once under StrictMode, which would double-fire the toasts; the tick gates
 * its announcements per week instead) — and never the boot or offline-catch-up paths, which fold
 * unlocks in SILENTLY (evaluateAndUnlock without toasts) so a returning/away player is never
 * spammed with a backlog of celebrations.
 */
function withLiveAchievements(next: GameState): GameState {
  const { state: out, unlocked } = evaluateAndUnlock(next);
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
      showToast(`${best}★ earned — ${name}`, {
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
  const tail = improved ? " — new best!" : ` · best ${formatScore(ch.scoreMetric, best)}`;
  setTimeout(() => {
    try {
      showToast(`${label} complete — ${scored}${tail}`, {
        tone: "positive",
        glyph: createElement(achievementIcon("Trophy"), { size: 15 }),
      });
    } catch {
      /* toast host not mounted (e.g. tests) */
    }
  }, 800);
}

interface GameContextValue {
  state: GameState;
  paused: boolean;
  setPaused: (p: boolean) => void;
  fast: boolean;
  setFast: (f: boolean) => void;
  offline: OfflineSummary | null;
  clearOffline: () => void;
  /** True when ANOTHER tab/window took over this save — this tab is frozen (no tick, no saves). */
  tabBlocked: boolean;
  /** Reload this tab so it boots from the freshest save and claims play back. */
  takeOverHere: () => void;
  // actions
  build: (product: Product, plannedUnits?: number, channelId?: ChannelId) => { ok: boolean; reason?: string };
  launchReady: (productId: string) => { ok: boolean; reason?: string; launchScore?: number; verdict?: "hit" | "solid" | "flop" | "steady" };
  research: (kind: ComponentKind) => void;
  unlockLens: () => void;
  unlockFinish: () => void;
  buyProject: (id: ProjectId) => void;
  buyUpgrade: (id: UpgradeId) => void;
  buyDesktop: () => void;
  assign: (id: string, assignment: Assignment) => void;
  train: (id: string) => void;
  rest: (id: string) => void;
  hire: (role: StaffRole, skill: number, name: string) => void;
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
  // Platform / OS division (DLC #1)
  setOsName: (name: string) => void;
  unlockPlatform: (on: boolean) => void;
  releaseOsVersion: () => void;
  licenseOsToRival: (rivalId: string) => void;
  revokeOsLicense: (rivalId: string) => void;
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
  // equity / stock market
  buyShares: (id: string, qty: number) => void;
  sellShares: (id: string, qty: number) => void;
  listCompany: (stake: number) => void;
  sellOwnStake: (pct: number) => void;
  cutProductPrice: (productId: string, newPrice: Money) => { ok: boolean; reason?: string };
  marketingPush: (productId: string) => { ok: boolean; reason?: string };
  giveRaise: (id: string) => void;
  resolveChoice: (optionId: string) => void;
}

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
    if (!loaded.onboarded) return { state: loaded, offline: null as OfflineSummary | null };
    const fansBefore = loaded.fans;
    const { state: caught, weeks, gain } = catchUpOffline(loaded);
    // F7 — don't punish a player for being away: pure weekly fan decay over the offline window
    // (up to 8 weeks of erosion they couldn't react to) is floored at the pre-catchup value.
    // Online weekly decay in advanceOneWeek is untouched.
    const floored: GameState = { ...caught, fans: Math.max(caught.fans, fansBefore) };
    // Fold in any achievements earned while away SILENTLY (no toast backlog on return). migrate()
    // already backfilled the on-disk earned set; this catches milestones crossed during catch-up.
    const withAch = evaluateAndUnlock(withScenarioRunStars(withChallengeScore(floored))).state;
    mergeProfileAchievements(withAch.unlockedAchievements); // capture the loaded run's full set (+ pre-profile saves)
    // A challenge whose scoreWeek was crossed while away locks + records its best silently here.
    syncChallengeBest(floored, withAch, false);
    // Persist immediately so lastActive advances on disk (prevents any re-application of gains).
    save({ ...withAch, lastActive: Date.now() });
    const topProduct = weeks > 0 ? topSellerWhileAway(loaded, withAch) : null;
    return { state: withAch, offline: weeks > 0 ? { weeks, gain, topProduct } : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<GameState>(boot.state);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
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
    const ms = (BALANCE.secondsPerTick / (fast ? BALANCE.fastMultiplier : 1)) * 1000;
    const id = setInterval(() => {
      setState((s) => {
        const next = withScenarioRunStars(withChallengeScore(advanceOneWeek(s)));
        const { state: out, unlocked } = evaluateAndUnlock(next);
        if (next.week !== announcedWeekRef.current) {
          announcedWeekRef.current = next.week;
          withRevToasts(s, next);
          withFanToasts(s, next);
          withStaffLevelToasts(s, next);
          withProductFinishToasts(s, next);
          announceAchievements(unlocked);
          mergeProfileAchievements(unlocked);
          announceScenarioStars(next);
          syncChallengeBest(s, next, true);
        }
        return out;
      });
    }, ms);
    return () => clearInterval(id);
  }, [paused, hidden, fast, state.bankrupt, tabBlocked, state.onboarded]);

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
    const base: GameState = { ...stateRef.current, lastActive: lastActiveRef.current };
    if (!base.onboarded || base.bankrupt) return;
    const fansBefore = base.fans;
    const { state: caught, weeks, gain } = catchUpOffline(base);
    if (weeks <= 0) return;
    // F7 — don't punish time away: floor fans at the pre-catchup value (online decay is untouched).
    const floored: GameState = { ...caught, fans: Math.max(caught.fans, fansBefore) };
    const withAch = evaluateAndUnlock(withScenarioRunStars(withChallengeScore(floored))).state;
    mergeProfileAchievements(withAch.unlockedAchievements); // capture the loaded run's full set (+ pre-profile saves)
    syncChallengeBest(floored, withAch, false); // lock + record a challenge that finished while away
    const stamped = Date.now();
    setState(withAch);
    save({ ...withAch, lastActive: stamped });
    lastActiveRef.current = stamped;
    lastSavedRef.current = withAch;
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
      showToast(`Breakthrough — ${projectById(id).name}`, { tone: "positive" });
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
  const buyDesktopCb = useCallback(() => {
    const prev = stateRef.current;
    const next = buyDesktop(prev);
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
    // New Game+ players already know the ropes — skip onboarding + the first-build coach.
    setState({ ...newGame(undefined, next), onboarded: true, tutorialDone: true, platformUnlocked: stateRef.current.platformUnlocked });
    setOffline(null);
    setPaused(false);
    setFast(false); // F37 — New Game+ must not inherit fast-forward speed.
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
    return true;
  }, []);

  const markOnboarded = useCallback(() => setState((s) => ({ ...s, onboarded: true })), []);
  const dismissTutorial = useCallback(() => setState((s) => ({ ...s, tutorialDone: true })), []);
  const setCompanyNameCb = useCallback((name: string) => setState((s) => setCompanyName(s, name)), []);
  // Toggle Sandbox / Creative mode ON or OFF for the current game. Ownership is enforced by the
  // caller (Settings only shows the toggle once the IAP entitlement is held).
  const setSandboxActive = useCallback((on: boolean) => setState((s) => ({ ...s, sandboxUnlocked: on })), []);
  const setOsNameCb = useCallback((name: string) => setState((s) => setOsName(s, name)), []);
  const unlockPlatformCb = useCallback((on: boolean) => setState((s) => unlockPlatform(s, on)), []);
  const releaseOsVersionCb = useCallback(() => {
    setState((s) => {
      const next = withLiveAchievements(releaseOsVersion(s));
      if (next !== s) sfx("era");
      return next;
    });
  }, []);
  const licenseOsToRivalCb = useCallback((rivalId: string) => setState((s) => licenseOsToRival(s, rivalId)), []);
  const revokeOsLicenseCb = useCallback((rivalId: string) => setState((s) => revokeOsLicense(s, rivalId)), []);
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
  const buySharesCb = useCallback((id: string, qty: number) => {
    const prev = stateRef.current;
    const next = withLiveAchievements(buyShares(prev, id, qty));
    const spent = (prev.cash - next.cash) as Money;
    if (spent > 0) emitSpend(spent);
    setState(next);
  }, []);
  const sellSharesCb = useCallback((id: string, qty: number) => setState((s) => sellShares(s, id, qty)), []);
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
  const giveRaiseCb = useCallback((id: string) => setState((s) => giveRaise(s, id)), []);
  const resolveChoiceCb = useCallback((optionId: string) => setState((s) => resolveChoice(s, optionId)), []);

  const restart = useCallback(() => {
    mergeProfileAchievements(stateRef.current.unlockedAchievements); // preserve this company's milestones for good
    clearSave();
    // Platform is an entitlement, not run progress — keep it across a fresh company.
    setState({ ...newGame(undefined, getLegacy()), platformUnlocked: stateRef.current.platformUnlocked });
    setOffline(null);
    setPaused(false);
    setFast(false); // F37 — a fresh company must not inherit fast-forward speed.
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
  }, []);

  const clearOffline = useCallback(() => setOffline(null), []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      paused,
      setPaused,
      fast,
      setFast,
      offline,
      clearOffline,
      tabBlocked,
      takeOverHere,
      build,
      launchReady: launchReadyCb,
      research,
      unlockLens: unlockLensCb,
      unlockFinish: unlockFinishCb,
      buyProject: buyProjectCb,
      buyUpgrade: buyUpgradeCb,
      buyDesktop: buyDesktopCb,
      assign,
      train,
      hire,
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
      setOsName: setOsNameCb,
      unlockPlatform: unlockPlatformCb,
      releaseOsVersion: releaseOsVersionCb,
      licenseOsToRival: licenseOsToRivalCb,
      revokeOsLicense: revokeOsLicenseCb,
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
      buyShares: buySharesCb,
      sellShares: sellSharesCb,
      listCompany: listCompanyCb,
      sellOwnStake: sellOwnStakeCb,
      cutProductPrice: cutProductPriceCb,
      marketingPush: marketingPushCb,
      giveRaise: giveRaiseCb,
      rest,
      resolveChoice: resolveChoiceCb,
    }),
    [state, paused, fast, offline, clearOffline, tabBlocked, takeOverHere, build, launchReadyCb, research, buyProjectCb, buyUpgradeCb, buyDesktopCb, assign, train, hire, recruit, hireCandidateCb, dismissCandidates, fire, upgradeHQ, advanceEra, goPublicCb, prestige, restart, startScenario, startChallenge, markOnboarded, dismissTutorial, exportSave, importSave, setCompanyNameCb, setSandboxActive, setOsNameCb, unlockPlatformCb, releaseOsVersionCb, licenseOsToRivalCb, revokeOsLicenseCb, placeFurnitureCb, moveFurnitureCb, rotateFurnitureCb, removeFurnitureCb, duplicateFurnitureCb, resetFurnitureCb, setLayoutCb, applyLayoutSnapshotCb, setFloorStyleCb, setWallStyleCb, buySharesCb, sellSharesCb, listCompanyCb, sellOwnStakeCb, cutProductPriceCb, giveRaiseCb, resolveChoiceCb],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
