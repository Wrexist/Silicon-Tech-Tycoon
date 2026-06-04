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
import { achievementById } from "../engine/achievements.ts";
import { achievementIcon } from "../design/achievementIcons.tsx";
import { showToast } from "../design/toast.tsx";
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

/**
 * Fold achievement evaluation into a state transition during LIVE play. Marks newly-satisfied
 * milestones unlocked AND fires one celebratory toast per new unlock (Lucide glyph, positive tone).
 * Only ever called from the live tick / live actions — never the boot or offline-catch-up paths,
 * which fold unlocks in SILENTLY (evaluateAndUnlock without toasts) so a returning/away player is
 * never spammed with a backlog of celebrations.
 */
function withLiveAchievements(next: GameState): GameState {
  const { state: out, unlocked } = evaluateAndUnlock(next);
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
  // actions
  build: (product: Product, plannedUnits?: number, channelId?: ChannelId) => { ok: boolean; reason?: string };
  launchReady: (productId: string) => { ok: boolean; reason?: string; launchScore?: number };
  research: (kind: ComponentKind) => void;
  buyProject: (id: ProjectId) => void;
  buyUpgrade: (id: UpgradeId) => void;
  assign: (id: string, assignment: Assignment) => void;
  train: (id: string) => void;
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
  unlockSandbox: () => void;
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
    // F4 — seed the feed-id counter above restored ids BEFORE any new feed item is generated.
    seedFeedSeq(res.state);
    const fansBefore = res.state.fans;
    const { state: caught, weeks, gain } = catchUpOffline(res.state);
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
  const stateRef = useRef(state);
  stateRef.current = state;

  // F1 — offline catch-up already ran exactly once in the initializer above; do NOT re-run it in
  // a mount effect (that re-applied gains against the stale on-disk lastActive, x4 under StrictMode).

  // Sim tick. One week per tick; the interval shrinks by fastMultiplier in Fast mode.
  useEffect(() => {
    if (paused || state.bankrupt) return;
    const ms = (BALANCE.secondsPerTick / (fast ? BALANCE.fastMultiplier : 1)) * 1000;
    const id = setInterval(() => {
      setState((s) => {
        const next = advanceOneWeek(s);
        withRevToasts(s, next);
        withFanToasts(s, next);
        withStaffLevelToasts(s, next);
        withProductFinishToasts(s, next);
        return withLiveAchievements(next);
      });
    }, ms);
    return () => clearInterval(id);
  }, [paused, fast, state.bankrupt]);

  // Persist on a fixed cadence (reads the latest via ref so it actually fires during play),
  // always stamping lastActive so offline catch-up measures time since the last save.
  useEffect(() => {
    const id = setInterval(() => save({ ...stateRef.current, lastActive: Date.now() }), 4000);
    return () => clearInterval(id);
  }, []);

  // Persist on background/exit too — but only when actually hidden, so returning to a visible
  // tab doesn't reset lastActive and swallow elapsed time.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") save({ ...stateRef.current, lastActive: Date.now() });
    };
    const onHide = () => save({ ...stateRef.current, lastActive: Date.now() });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  const build = useCallback((product: Product, plannedUnits?: number, channelId?: ChannelId) => {
    const result = startBuild(stateRef.current, product, plannedUnits, channelId);
    if (result.ok) setState(result.state);
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
    setState((s) => researchNext(s, kind));
  }, []);

  const buyProjectCb = useCallback((id: ProjectId) => setState((s) => buyProject(s, id)), []);
  const buyUpgradeCb = useCallback((id: UpgradeId) => setState((s) => buyUpgrade(s, id)), []);
  const assign = useCallback((id: string, a: Assignment) => setState((s) => assignStaff(s, id, a)), []);
  const train = useCallback((id: string) => setState((s) => trainStaff(s, id)), []);

  const hire = useCallback((role: StaffRole, skill: number, name: string) => {
    setState((s) => hireStaff(s, role, skill, name));
  }, []);
  const recruit = useCallback((tier: RecruitTier) => setState((s) => startRecruitment(s, tier)), []);
  const hireCandidateCb = useCallback((candidateId: string) => setState((s) => hireCandidate(s, candidateId)), []);
  const dismissCandidates = useCallback(() => setState((s) => clearCandidates(s)), []);

  const fire = useCallback((id: string) => setState((s) => fireStaff(s, id)), []);
  const upgradeHQ = useCallback(() => setState((s) => upgradeFacility(s)), []);
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
    const next: GameState = { ...migrated, lastActive: Date.now() };
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
  const unlockSandbox = useCallback(() => setState((s) => ({ ...s, sandboxUnlocked: true })), []);
  const placeFurnitureCb = useCallback((type: FurnitureId, c: number, r: number, rot: Rot) => setState((s) => placeFurniture(s, type, c, r, rot)), []);
  const moveFurnitureCb = useCallback((iid: string, c: number, r: number) => setState((s) => moveFurniture(s, iid, c, r)), []);
  const rotateFurnitureCb = useCallback((iid: string) => setState((s) => rotateFurniture(s, iid)), []);
  const removeFurnitureCb = useCallback((iid: string) => setState((s) => removeFurniture(s, iid)), []);
  const duplicateFurnitureCb = useCallback((iid: string) => setState((s) => duplicateFurniture(s, iid)), []);
  const resetFurnitureCb = useCallback(() => setState((s) => resetFurniture(s)), []);
  const setLayoutCb = useCallback((layout: PlacedItem[]) => setState((s) => setLayout(s, layout)), []);
  const setFloorStyleCb = useCallback((i: number) => setState((s) => setFloorStyle(s, i)), []);
  const setWallStyleCb = useCallback((i: number) => setState((s) => setWallStyle(s, i)), []);
  const buySharesCb = useCallback((id: string, qty: number) => setState((s) => withLiveAchievements(buyShares(s, id, qty))), []);
  const sellSharesCb = useCallback((id: string, qty: number) => setState((s) => sellShares(s, id, qty)), []);
  const listCompanyCb = useCallback((stake: number) => setState((s) => withLiveAchievements(listCompany(s, stake))), []);
  const sellOwnStakeCb = useCallback((pct: number) => setState((s) => sellOwnStake(s, pct)), []);

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
      build,
      launchReady: launchReadyCb,
      research,
      buyProject: buyProjectCb,
      buyUpgrade: buyUpgradeCb,
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
      unlockSandbox,
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
    }),
    [state, paused, fast, offline, clearOffline, build, launchReadyCb, research, buyProjectCb, buyUpgradeCb, assign, train, hire, recruit, hireCandidateCb, dismissCandidates, fire, upgradeHQ, advanceEra, goPublicCb, prestige, restart, markOnboarded, dismissTutorial, exportSave, importSave, setCompanyNameCb, unlockSandbox, placeFurnitureCb, moveFurnitureCb, rotateFurnitureCb, removeFurnitureCb, duplicateFurnitureCb, resetFurnitureCb, setLayoutCb, setFloorStyleCb, setWallStyleCb, buySharesCb, sellSharesCb, listCompanyCb, sellOwnStakeCb],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
