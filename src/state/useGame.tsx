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
  type GameState,
} from "./gameState.ts";
import { getLegacy, setLegacy } from "./legacy.ts";
import type { Assignment } from "../engine/types.ts";
import type { ProjectId } from "../engine/research.ts";
import type { UpgradeId } from "../engine/upgrades.ts";
import type { ChannelId } from "../engine/marketing.ts";
import type { FurnitureId, PlacedItem, Rot } from "../engine/furniture.ts";
import { clearSave, exportSaveString, importSaveString, loadResult, save } from "./persistence.ts";
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

/** Fire one celebratory toast per newly-unlocked achievement (Lucide glyph, positive tone). */
function announceAchievements(unlocked: readonly string[]): void {
  for (const id of unlocked) {
    const a = achievementById(id);
    if (!a) continue;
    try {
      showToast(`Achievement unlocked — ${a.title}`, {
        tone: "positive",
        glyph: createElement(achievementIcon(a.icon), { size: 15 }),
      });
    } catch {
      /* toast host not mounted (e.g. tests) */
    }
  }
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
  return out;
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
  launchReady: (productId: string) => { ok: boolean; reason?: string; launchScore?: number };
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
  markOnboarded: () => void;
  dismissTutorial: () => void;
  // save export / import (offline backup)
  exportSave: () => string;
  importSave: (str: string) => boolean;
  setCompanyName: (name: string) => void;
  setSandboxActive: (on: boolean) => void;
  // office builder
  placeFurniture: (type: FurnitureId, c: number, r: number, rot: Rot) => void;
  moveFurniture: (iid: string, c: number, r: number) => void;
  rotateFurniture: (iid: string) => void;
  removeFurniture: (iid: string) => void;
  duplicateFurniture: (iid: string) => void;
  resetFurniture: () => void;
  setLayout: (layout: PlacedItem[]) => void;
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
    const withAch = evaluateAndUnlock(floored).state;
    // Persist immediately so lastActive advances on disk (prevents any re-application of gains).
    save({ ...withAch, lastActive: Date.now() });
    return { state: withAch, offline: weeks > 0 ? { weeks, gain } : null };
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
    if (paused || state.bankrupt || tabBlocked || !state.onboarded) return;
    const ms = (BALANCE.secondsPerTick / (fast ? BALANCE.fastMultiplier : 1)) * 1000;
    const id = setInterval(() => {
      setState((s) => {
        const next = advanceOneWeek(s);
        const { state: out, unlocked } = evaluateAndUnlock(next);
        if (next.week !== announcedWeekRef.current) {
          announcedWeekRef.current = next.week;
          withRevToasts(s, next);
          withFanToasts(s, next);
          withStaffLevelToasts(s, next);
          withProductFinishToasts(s, next);
          announceAchievements(unlocked);
        }
        return out;
      });
    }, ms);
    return () => clearInterval(id);
  }, [paused, fast, state.bankrupt, tabBlocked, state.onboarded]);

  // One write path for every persistence trigger below: skip while another tab owns the save,
  // and always stamp lastActive so offline catch-up measures time since the last write. The old
  // three inlined copies of this had already drifted once (the double-offline bug).
  const persistNow = useCallback(() => {
    if (!tabBlockedRef.current) save({ ...stateRef.current, lastActive: Date.now() });
  }, []);

  // Persist on a fixed cadence (reads the latest via ref so it actually fires during play).
  useEffect(() => {
    const id = setInterval(persistNow, 4000);
    return () => clearInterval(id);
  }, [persistNow]);

  // Persist on background/exit too — but only when actually hidden, so returning to a visible
  // tab doesn't reset lastActive and swallow elapsed time.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") persistNow();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", persistNow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", persistNow);
    };
  }, [persistNow]);

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
    if (result.ok) setState(withLiveAchievements(result.state));
    return { ok: result.ok, reason: result.reason, launchScore: result.launchScore };
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
    const next = getLegacy() + 1;
    setLegacy(next);
    clearSave();
    // New Game+ players already know the ropes — skip onboarding + the first-build coach.
    setState({ ...newGame(undefined, next), onboarded: true, tutorialDone: true });
    setOffline(null);
    setPaused(false);
    setFast(false); // F37 — New Game+ must not inherit fast-forward speed.
  }, []);
  // Serialize the live state for a downloadable / copyable backup (works pre-first-autosave).
  const exportSave = useCallback(() => exportSaveString(stateRef.current), []);

  // Validate + apply an imported backup. Returns false (and changes nothing) on a bad string, so
  // the caller can surface a clear error. On success we set the migrated state immutably, stamp
  // lastActive (so offline catch-up doesn't fire on a fresh paste), and persist immediately.
  const importSave = useCallback((str: string) => {
    const migrated = importSaveString(str);
    if (!migrated) return false;
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
  const placeFurnitureCb = useCallback((type: FurnitureId, c: number, r: number, rot: Rot) => setState((s) => placeFurniture(s, type, c, r, rot)), []);
  const moveFurnitureCb = useCallback((iid: string, c: number, r: number) => setState((s) => moveFurniture(s, iid, c, r)), []);
  const rotateFurnitureCb = useCallback((iid: string) => setState((s) => rotateFurniture(s, iid)), []);
  const removeFurnitureCb = useCallback((iid: string) => setState((s) => removeFurniture(s, iid)), []);
  const duplicateFurnitureCb = useCallback((iid: string) => setState((s) => duplicateFurniture(s, iid)), []);
  const resetFurnitureCb = useCallback(() => setState((s) => resetFurniture(s)), []);
  const setLayoutCb = useCallback((layout: PlacedItem[]) => setState((s) => setLayout(s, layout)), []);
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
    clearSave();
    setState(newGame(undefined, getLegacy()));
    setOffline(null);
    setPaused(false);
    setFast(false); // F37 — a fresh company must not inherit fast-forward speed.
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
      markOnboarded,
      dismissTutorial,
      exportSave,
      importSave,
      setCompanyName: setCompanyNameCb,
      setSandboxActive,
      placeFurniture: placeFurnitureCb,
      moveFurniture: moveFurnitureCb,
      rotateFurniture: rotateFurnitureCb,
      removeFurniture: removeFurnitureCb,
      duplicateFurniture: duplicateFurnitureCb,
      resetFurniture: resetFurnitureCb,
      setLayout: setLayoutCb,
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
    [state, paused, fast, offline, clearOffline, tabBlocked, takeOverHere, build, launchReadyCb, research, buyProjectCb, buyUpgradeCb, buyDesktopCb, assign, train, hire, recruit, hireCandidateCb, dismissCandidates, fire, upgradeHQ, advanceEra, goPublicCb, prestige, restart, markOnboarded, dismissTutorial, exportSave, importSave, setCompanyNameCb, setSandboxActive, placeFurnitureCb, moveFurnitureCb, rotateFurnitureCb, removeFurnitureCb, duplicateFurnitureCb, resetFurnitureCb, setLayoutCb, setFloorStyleCb, setWallStyleCb, buySharesCb, sellSharesCb, listCompanyCb, sellOwnStakeCb, cutProductPriceCb, giveRaiseCb, resolveChoiceCb],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
