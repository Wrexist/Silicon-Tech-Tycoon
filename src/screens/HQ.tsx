import {
  ArrowUp, Check, ChevronRight, Clock, Coffee, Copy, Cpu, Factory, FlaskConical,
  HelpCircle, LayoutGrid, Lock, Megaphone, Monitor, Newspaper, PaintbrushVertical, PencilRuler,
  RotateCw, Rocket, Search, Shapes, Sparkles, Trash2, TrendingDown, TrendingUp,
  Undo2, Users, X, Zap, Smile, Crosshair, type LucideIcon,
} from "lucide-react";
import { Button, Card, EmptyState, SectionHeader, StatPill } from "../design/primitives.tsx";
import { ScenarioTracker } from "../components/ScenarioTracker.tsx";
import { ChallengeTracker } from "../components/ChallengeTracker.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { launchOutcome } from "../design/launchFeedback.ts";
import { BALANCE } from "../engine/balance.ts";
import { CATEGORY_LIST } from "../engine/catalogs.ts";
import { eraName, maxEra } from "../engine/eras.ts";
import { dollars, format, formatShortDollars, toDollars, type Money } from "../engine/money.ts";
import {
  canPlace,
  furnitureCost,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  footprint,
  FURNITURE,
  furnitureDef,
  GRID,
  searchFurniture,
  type FurnitureCategory,
  type FurnitureId,
  type PlacedItem,
  type Rot,
} from "../engine/furniture.ts";
import { FLOOR_FINISHES, WALL_STYLES } from "../engine/roomStyle.ts";
import { UPGRADE_LINES, type UpgradeId } from "../engine/upgrades.ts";
import { RESEARCH_PROJECTS, projectById } from "../engine/research.ts";
import { STAT_KEYS, type CategoryId } from "../engine/types.ts";
import { canAdvance, canAffordFurniture, canIPO, burn, nextWeekRevenue, facility, upgradeCost, upgradeGate, deskCapacity, officeComfortMoodBonus, officeFocusMult, officeInspoBonus, type FeedItem, type GameState } from "../state/gameState.ts";
import { runwayWeeks } from "../engine/economy.ts";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useGame } from "../state/useGame.tsx";
import { useSettings, getSettings, setSettings } from "../state/settings.ts";
import { IsoScene } from "../components/IsoScene.tsx";
import { DecorateTutorial } from "../components/DecorateTutorial.tsx";
import { FurnitureThumb } from "../components/FurnitureThumb.tsx";
import { isDarkTheme, prefersReducedMotion, webglSupported } from "../garage3d/support.ts";
import type { BuildProps } from "../garage3d/Garage3D.tsx";
import { ErrorBoundary } from "../components/ErrorBoundary.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import type { Tab } from "../components/BottomNav.tsx";
import "./hq.css";

/** prefers-reduced-motion, kept LIVE: enabling it mid-session downgrades the always-animating 3D
 *  office to the static IsoScene without a reload (the one-shot read only covered mount time). */
function useReducedMotionLive(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq?.addEventListener) return;
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const UPGRADE_ICONS: Record<string, LucideIcon> = { Cpu, PencilRuler, FlaskConical, Megaphone, Coffee, Factory };
// Each upgrade line is colour-coded by the company function it powers.
const UPGRADE_FN: Record<UpgradeId, { accent: string; soft: string }> = {
  computers: { accent: "var(--fn-eng)", soft: "var(--fn-eng-soft)" },
  designSuite: { accent: "var(--fn-design)", soft: "var(--fn-design-soft)" },
  testLab: { accent: "var(--fn-eng)", soft: "var(--fn-eng-soft)" },
  marketing: { accent: "var(--fn-mkt)", soft: "var(--fn-mkt-soft)" },
  amenities: { accent: "var(--fn-team)", soft: "var(--fn-team-soft)" },
  assembly: { accent: "var(--fn-eng)", soft: "var(--fn-eng-soft)" },
};

const Garage3D = lazy(() => import("../garage3d/Garage3D.tsx").then((m) => ({ default: m.Garage3D })));

// A fine pointer (mouse/trackpad) means a physical keyboard is almost certainly present — the only
// place the WASD camera hint makes sense. Touch phones report a coarse pointer and get no hint.
const FINE_POINTER = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches;

export function HQ({ onNavigate, onOpenBank, active = true }: { onNavigate: (t: Tab) => void; onOpenBank: () => void; active?: boolean }) {
  const { state, advanceEra, launchReady, goPublic, resolveChoice } = useGame();
  const settings = useSettings();
  const onLaunch = (id: string) => {
    const launchedBefore = state.launched; // before launchReady records this product
    const res = launchReady(id);
    if (res.ok) {
      haptic.success();
      // Shared with the Design Lab; keys the celebration off the recorded (competition-adjusted)
      // verdict, so the launch moment can never contradict what Market/feed record.
      const { isHit, feedback } = launchOutcome(res, launchedBefore);
      sfx("launch");
      if (isHit) { setTimeout(() => sfx("hit"), 380); emitCelebrate(); }
      showToast(feedback.text, { tone: feedback.tone, glyph: <Rocket size={15} /> });
    }
  };
  const reducedMotion = useReducedMotionLive();
  const use3d = settings.garage3d && webglSupported() && !reducedMotion;
  const ipoReady = canIPO(state);
  const hasProduction =
    state.building.length > 0 || state.launched.some((l) => l.weeksElapsed < l.weeklyUnits.length);
  const advanceReady = canAdvance(state);
  const nextEraUnlocks = advanceReady
    ? CATEGORY_LIST.filter((c) => c.unlockEra === state.era + 1).map((c) => c.displayName)
    : [];

  return (
    <div className="hq">
      <OfficeScene use3d={use3d} hasProduction={hasProduction} active={active} onNavigate={onNavigate} onOpenBank={onOpenBank} />

      <ScenarioTracker />
      <ChallengeTracker />

      {ipoReady && (
        <Card className="hq__era hq__ipo">
          <div className="hq__era-body">
            <span className="hq__era-title">Ready to go public</span>
            <span className="hq__era-sub">Your reputation is world-class. Take the company to IPO.</span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              goPublic();
              haptic.success();
              sfx("era");
            }}
          >
            <TrendingUp size={15} /> IPO
          </Button>
        </Card>
      )}

      {advanceReady && (
        <Card className="hq__era">
          <div className="hq__era-body">
            <span className="hq__era-title">New era unlocked</span>
            <span className="hq__era-sub">
              {nextEraUnlocks.length > 0
                ? `Unlocks: ${nextEraUnlocks.join(", ")} + new component tiers`
                : `New tech & components for the ${eraName(state.era + 1)}`}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              advanceEra();
              haptic.success();
              showToast(`Welcome to the ${eraName(state.era + 1)}`, { tone: "positive", glyph: <Sparkles size={15} /> });
            }}
          >
            Advance
          </Button>
        </Card>
      )}

      <div className="hq__stats">
        <StatPill label="Products" value={state.launched.length} />
        <StatPill label="Team" value={state.staff.length} />
        <StatPill label="Reputation" value={Math.round(state.reputation)} tone={state.reputation >= 50 ? "positive" : "neutral"} />
        {state.era < maxEra()
          ? <StatPill label="Era" value={`${state.era}/${maxEra()}`} tone="accent" />
          : <StatPill label="Fans" value={state.fans >= 1000 ? `${(state.fans / 1000).toFixed(1)}k` : String(state.fans)} tone={state.fans >= 500 ? "positive" : "neutral"} />}
      </div>
      {(() => {
        const wkBurn = burn(state);
        const wkRev = nextWeekRevenue(state);
        const runway = runwayWeeks(state.cash, wkBurn, wkRev);
        // The pill is already labelled "Runway" — keep the value short so it doesn't read "Runway 7wk runway".
        const runwayLabel = runway === Infinity ? "Profitable" : runway > 520 ? "10y+" : runway > 52 ? `${Math.round(runway / 52)}y` : `${runway} wk`;
        const runwayTone = runway === Infinity ? "positive" : runway < 8 ? "negative" : runway < 20 ? "neutral" : "positive";
        return (
          <div className="hq__fin-pills">
            <StatPill label="Cash" value={format(state.cash)} tone={state.cash >= 0 ? "neutral" : "negative"} />
            <StatPill label="Runway" value={runwayLabel} tone={runwayTone as "positive" | "negative" | "neutral"} />
          </div>
        );
      })()}
      {!advanceReady && !ipoReady && <EraGoalCard state={state} />}

      {/* Player-choice event card — requires a decision before advancing */}
      {state.pendingChoice && (
        <Card className="hq__choice">
          <div className="hq__choice-head">
            <Zap size={14} className="hq__choice-icon" aria-hidden />
            <span className="hq__choice-title">{state.pendingChoice.event.title}</span>
          </div>
          <p className="hq__choice-body">{state.pendingChoice.event.body}</p>
          <div className="hq__choice-options">
            {state.pendingChoice.event.options.map((opt) => (
              <button
                key={opt.id}
                className="hq__choice-opt"
                onClick={() => { resolveChoice(opt.id); haptic.success(); }}
              >
                <span className="hq__choice-opt-label">{opt.label}</span>
                <span className="hq__choice-opt-desc">{opt.description}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Ready to launch */}
      {state.ready.length > 0 && (
        <Card className="hq__ready">
          <SectionHeader title="Ready to launch" accessory="market & release" />
          {state.ready.map((p) => (
            <div className="hq__ready-row" key={p.id}>
              <div className="hq__ready-thumb"><DeviceRenderer product={p} size={52} /></div>
              <div className="hq__ready-info">
                <span className="hq__ready-name">{p.name}</span>
                {p.plannedUnits != null && <span className="hq__ready-sub">{p.plannedUnits.toLocaleString()} units ready</span>}
              </div>
              <Button size="sm" onClick={() => onLaunch(p.id)}>
                <Rocket size={15} /> Launch
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* In production */}
      {state.building.length > 0 && (
        <Card>
          <SectionHeader title="In production" accessory="manufacturing" />
          {state.building.map((job) => {
            const pct = Math.min(100, Math.round((job.weeksElapsed / job.totalWeeks) * 100));
            const weeksLeft = Math.max(0, job.totalWeeks - job.weeksElapsed);
            return (
              <div className="hq__build" key={job.product.id}>
                <div className="hq__build-row">
                  <div className="hq__ready-thumb"><DeviceRenderer product={job.product} size={48} /></div>
                  <div className="hq__build-body">
                    <div className="hq__build-head">
                      <span className="hq__ready-name">{job.product.name}</span>
                      <span className="hq__build-pct tnum">
                        {pct}%{weeksLeft > 0 && <span className="hq__build-eta"> · wk {state.week + weeksLeft}</span>}
                      </span>
                    </div>
                    <div className="hq__build-track">
                      <div className="hq__build-fill" style={{ width: `${pct}%`, background: pct >= 80 ? "var(--positive)" : undefined }} />
                    </div>
                    {job.plannedUnits != null && <span className="hq__build-units">{job.plannedUnits.toLocaleString()} units</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Upgrades />

      {state.launched.length === 0 ? (
        <Card>
          <SectionHeader title="Get started" />
          <p className="hq__cta-text">Your garage is ready. Design your first product and launch it into the market.</p>
          <Button block onClick={() => onNavigate("design")}><PencilRuler size={17} /> Open the Design Lab</Button>
        </Card>
      ) : (
        <>
          <PerformanceCard state={state} onNavigate={onNavigate} />
          <StrategicInsightsCard state={state} onNavigate={onNavigate} />
          {state.feed.length > 0 && <FeedCard feed={state.feed} week={state.week} onNavigate={onNavigate} />}
        </>
      )}
    </div>
  );
}

/** Live office buffs + seat count, shown atop the shop so the player SEES the office working for
 *  the team. Each bar fills toward the BALANCE.shop cap (faint track = diminishing returns). */
function OfficeOverview({ state }: { state: GameState }) {
  const comfort = officeComfortMoodBonus(state);
  const focus = officeFocusMult(state) - 1; // 0..focusCap
  const inspo = officeInspoBonus(state);
  const rows: { icon: LucideIcon; label: string; value: string; frac: number; tint: string }[] = [
    { icon: Smile, label: "Mood", value: `+${Math.round(comfort)}`, frac: comfort / BALANCE.shop.comfortCap, tint: "var(--fn-team)" },
    { icon: Crosshair, label: "Research", value: `+${Math.round(focus * 100)}%`, frac: focus / BALANCE.shop.focusCap, tint: "var(--fn-eng)" },
    { icon: Sparkles, label: "Design", value: `+${Math.round(inspo)}`, frac: inspo / BALANCE.shop.inspCap, tint: "var(--fn-design)" },
  ];
  return (
    <div className="hqb__office">
      <div className="hqb__office-stats">
        {rows.map((r) => (
          <div className="hqb__office-stat" key={r.label}>
            <span className="hqb__office-head">
              <span className="hqb__office-label"><r.icon size={12} aria-hidden /> {r.label}</span>
              <span className="hqb__office-val tnum" style={{ color: r.tint }}>{r.value}</span>
            </span>
            <span className="hqb__office-bar">
              <span className="hqb__office-fill" style={{ width: `${Math.min(100, Math.round(r.frac * 100))}%`, background: r.tint }} />
            </span>
          </div>
        ))}
      </div>
      <div className="hqb__office-seats">
        <Users size={12} aria-hidden /> Seats <b className="tnum">{state.staff.length}/{deskCapacity(state)}</b>
        <span className="hqb__office-seats-hint">— buy a desk to add one</span>
      </div>
    </div>
  );
}

// The garage/office scene + the interactive furniture builder ("Decorate" mode).
function OfficeScene({ use3d, hasProduction, active, onNavigate, onOpenBank }: { use3d: boolean; hasProduction: boolean; active: boolean; onNavigate: (t: Tab) => void; onOpenBank: () => void }) {
  const { state, placeFurniture, moveFurniture, rotateFurniture, removeFurniture, duplicateFurniture, applyLayoutSnapshot, setFloorStyle, setWallStyle } = useGame();
  const [build, setBuild] = useState(false);
  const [placingType, setPlacingType] = useState<FurnitureId | null>(null);
  const [placeRot, setPlaceRot] = useState<Rot>(0);
  const [selectedIid, setSelectedIid] = useState<string | null>(null);
  const [cat, setCat] = useState<FurnitureCategory>("desks");
  const [search, setSearch] = useState("");
  const [roomTab, setRoomTab] = useState(false);
  const [tutorial, setTutorial] = useState(false); // first-run Decorate coach (or replayed via ?)
  // Undo snapshots carry BOTH layout and cash, so undoing a purchase refunds in full (a true
  // reversal); Sell is the separate, deliberate 50%-refund path.
  const history = useRef<{ layout: PlacedItem[]; cash: Money }[]>([]);
  const [histLen, setHistLen] = useState(0); // mirror of history depth so Undo's disabled state stays live
  const dark = isDarkTheme();
  // If the GPU drops the WebGL context mid-game, fall back to the 2D IsoScene instead of black.
  const [glLost, setGlLost] = useState(false);

  // Decorate is a full-screen overlay: lock background page scroll while it's open so a drag on
  // the editor can't scroll HQ underneath it.
  useEffect(() => {
    if (!build) return;
    document.body.classList.add("hq-deco-open");
    return () => document.body.classList.remove("hq-deco-open");
  }, [build]);

  const selected = build ? state.layout.find((x) => x.iid === selectedIid) ?? null : null;
  const searching = search.trim().length > 0;
  const visibleItems = searching ? searchFurniture(search) : FURNITURE.filter((f) => f.category === cat);

  // Always-current layout for the undo snapshot, so the memoized builder callbacks below don't
  // have to be rebuilt every render just to capture the latest layout reference.
  const layoutRef = useRef(state.layout);
  layoutRef.current = state.layout;
  const cashRef = useRef(state.cash);
  cashRef.current = state.cash;
  const snapshot = useCallback(() => {
    history.current.push({ layout: layoutRef.current, cash: cashRef.current });
    if (history.current.length > 40) history.current.shift();
    setHistLen(history.current.length);
  }, []);
  const undo = () => {
    const prev = history.current.pop();
    setHistLen(history.current.length);
    if (prev) {
      applyLayoutSnapshot(prev);
      setSelectedIid(null);
      setPlacingType(null);
      haptic.medium();
    }
  };

  // Memoized: the 1s/8s sim tick re-renders this component, and a fresh builder object every
  // render defeats React.memo on the 1,700-line R3F scene (the v9-flagged perf gap). Deps only
  // change when the player actually interacts with Decorate mode.
  const builder: BuildProps = useMemo(() => ({
    build,
    layout: state.layout,
    placingType,
    placeRot,
    selectedIid,
    onPlaceCell: (c, r) => {
      if (!placingType) return;
      if (!canAffordFurniture(state, placingType)) {
        showToast(`Can't afford — ${furnitureDef(placingType).name} costs ${format(dollars(furnitureCost(placingType)))}`, { tone: "negative" });
        haptic.error();
        return;
      }
      snapshot();
      placeFurniture(placingType, c, r, placeRot);
      haptic.light();
      sfx("tap");
    },
    onMoveItem: (iid, c, r) => {
      snapshot();
      moveFurniture(iid, c, r);
      haptic.light();
    },
    onSelectItem: (iid) => {
      setSelectedIid(iid);
      if (iid) setPlacingType(null);
    },
  }), [build, state.layout, placingType, placeRot, selectedIid, snapshot, placeFurniture, moveFurniture]);

  // Narrowed staff snapshot for the 3D scene: per-tick mood drift/XP gives every staff object a
  // NEW identity each week, which would re-reconcile the whole scene. The scene only shows
  // identity, desk count, a coarse mood band and the headline skills — so keep the same array
  // until one of those actually changes.
  const staffSceneKey = state.staff
    .map((s) => `${s.id}${s.appearance.skin}${s.appearance.hair}${s.appearance.hairColor}${s.appearance.shirt}${s.appearance.accessory}${Math.round(s.mood / 12)}${s.skills.engineering},${s.skills.design},${s.skills.marketing}`)
    .join(";");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const staff3d = useMemo(() => state.staff, [staffSceneKey]);
  // GPU dropped the WebGL context: fall back to the 2D office silently — no error toast (the
  // swap speaks for itself and a "Try 3D again" affordance sits on the scene). Leave Decorate
  // cleanly: the 2D fallback has no editor, so lingering place/select state would point at UI
  // that no longer exists.
  const onGlLost = useCallback(() => {
    setGlLost(true);
    setBuild(false);
    setPlacingType(null);
    setSelectedIid(null);
  }, []);

  const exit = () => {
    setBuild(false);
    setPlacingType(null);
    setSelectedIid(null);
    history.current = [];
    setHistLen(0);
  };

  // Tapping a catalog item drops it into the first free cell + selects it, so the player can
  // immediately drag it where they want.
  const pick = (type: FurnitureId) => {
    if (!canAffordFurniture(state, type)) {
      showToast(`Can't afford — ${furnitureDef(type).name} costs ${format(dollars(furnitureCost(type)))}`, { tone: "negative" });
      haptic.error();
      return;
    }
    const def = furnitureDef(type);
    for (let r = 0; r <= GRID.n - 1; r++) {
      for (let c = 0; c <= GRID.n - 1; c++) {
        const fp = footprint(def, 0);
        if (c + fp.w > GRID.n || r + fp.d > GRID.n) continue;
        if (canPlace(state.layout, type, c, r, 0)) {
          snapshot();
          placeFurniture(type, c, r, 0);
          setSelectedIid(`f${state.furnitureCounter}`);
          setPlacingType(null);
          haptic.success();
          sfx("tap");
          return;
        }
      }
    }
    showToast("No room — remove something first.", { tone: "negative" });
    haptic.error();
  };

  return (
    <Card variant="flush" className={build ? "hq__deco" : undefined}>
      <div className={`hq__scene${build ? " hq__scene--build" : ""}`}>
        {use3d && !glLost ? (
          <ErrorBoundary fallback={<IsoScene staff={state.staff} staffCount={state.staff.length} facilityTier={state.facilityTier} hasProduction={hasProduction} />}>
            <Suspense fallback={<IsoScene staff={state.staff} staffCount={state.staff.length} facilityTier={state.facilityTier} hasProduction={hasProduction} />}>
              <Garage3D
                staff={staff3d}
                staffCount={staff3d.length}
                facilityTier={state.facilityTier}
                hasProduction={hasProduction}
                upgrades={state.upgrades}
                companyName={state.companyName}
                dark={dark}
                onContextLost={onGlLost}
                builder={builder}
                roomStyle={state.roomStyle}
                desktops={state.desktops}
                height={build ? "100%" : 420}
                paused={!active}
                onTapStaff={() => onNavigate("company")}
                onTapBank={onOpenBank}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <>
            <IsoScene staff={state.staff} staffCount={state.staff.length} facilityTier={state.facilityTier} hasProduction={hasProduction} />
            {/* Context loss is recoverable — let the player re-attempt the 3D view without
                relaunching the app (a fresh Canvas mount usually gets a new GPU context). */}
            {glLost && (
              <button className="hq__retry3d" onClick={() => { setGlLost(false); haptic.light(); }}>
                <RotateCw size={13} aria-hidden /> Try 3D again
              </button>
            )}
          </>
        )}
        {!build && <div className="hq__scene-tag">{eraName(state.era)}</div>}
        {/* WASD is keyboard-only — never show it on a touch device (the iOS target), where it's
            both useless and confusing. Gate on a fine pointer (mouse/trackpad). */}
        {use3d && !build && FINE_POINTER && <div className="hq__camhint" aria-hidden>WASD to look around</div>}
        {use3d && !build && (
          <button className="hq__decorate" onClick={() => { setBuild(true); haptic.light(); if (!getSettings().decorateTutorialSeen) setTutorial(true); }}>
            <LayoutGrid size={15} /> Decorate
          </button>
        )}
        {build && (
          <div className="hqb__top">
            <div className="hqb__top-id">
              <span className="hqb__title">Decorate</span>
              <span className="hqb__cash tnum">{format(state.cash)}</span>
            </div>
            <div className="hqb__top-actions">
              <button className="hqb__icon" aria-label="How Decorate works" onClick={() => { setTutorial(true); haptic.light(); }}>
                <HelpCircle size={15} />
              </button>
              <button className="hqb__icon" aria-label="Undo" disabled={histLen === 0} onClick={undo}>
                <Undo2 size={15} />
              </button>
              <Button size="sm" onClick={exit}><Check size={14} /> Done</Button>
            </div>
          </div>
        )}
      </div>

      {build && (
        <div className="hqb__panel">
          {selected ? (
            <div className="hqb__toolbar">
              <div className="hqb__sel">
                <span className="hqb__sel-name">{furnitureDef(selected.type).name}</span>
                <span className="hqb__sel-hint">Drag it to move · or use the buttons</span>
              </div>
              <div className="hqb__row">
                <button className="hqb__tool" onClick={() => { snapshot(); rotateFurniture(selected.iid); haptic.light(); }}><RotateCw size={16} /> Rotate</button>
                <button className="hqb__tool" onClick={() => { snapshot(); duplicateFurniture(selected.iid); haptic.light(); }}><Copy size={16} /> Duplicate</button>
                <button className="hqb__tool hqb__tool--danger" onClick={() => { snapshot(); removeFurniture(selected.iid); setSelectedIid(null); haptic.medium(); sfx("cash"); }}><Trash2 size={16} /> Sell · +{format(dollars(Math.round(furnitureCost(selected.type) * BALANCE.shop.resaleRate)))}</button>
                <button className="hqb__tool" onClick={() => setSelectedIid(null)}><X size={16} /> Deselect</button>
              </div>
            </div>
          ) : (
            <>
              <OfficeOverview state={state} />
              <div className="hqb__search">
                <Search size={15} className="hqb__search-icon" />
                <input
                  className="hqb__search-input"
                  value={search}
                  placeholder="Search furniture…"
                  aria-label="Search furniture"
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searching && (
                  <button className="hqb__search-clear" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>
                )}
              </div>
              {!searching && (
                <div className="hqb__cats">
                  <button className={`hqb__cat hqb__cat--room${roomTab ? " hqb__cat--on" : ""}`} onClick={() => { setRoomTab(true); setPlacingType(null); haptic.light(); }}>
                    <PaintbrushVertical size={13} /> Room
                  </button>
                  {CATEGORY_ORDER.map((c) => (
                    <button key={c} className={`hqb__cat${!roomTab && cat === c ? " hqb__cat--on" : ""}`} onClick={() => { setCat(c); setRoomTab(false); haptic.light(); }}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              )}
              {!searching && roomTab ? (
                <div className="hqb__room">
                  <div className="hqb__room-group">
                    <span className="hqb__room-label">Floor</span>
                    <div className="hqb__swatches">
                      {FLOOR_FINISHES.map((f, i) => (
                        <button key={f.id} className={`hqb__sw${state.roomStyle.floor === i ? " hqb__sw--on" : ""}`} aria-pressed={state.roomStyle.floor === i} aria-label={`${f.name} floor`} onClick={() => { setFloorStyle(i); haptic.light(); }}>
                          <span className="hqb__sw-chip" style={{ background: dark ? f.dark : f.light }} />
                          <span className="hqb__sw-name">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="hqb__room-group">
                    <span className="hqb__room-label">Walls</span>
                    <div className="hqb__swatches">
                      {WALL_STYLES.map((w, i) => (
                        <button key={w.id} className={`hqb__sw${state.roomStyle.wall === i ? " hqb__sw--on" : ""}`} aria-pressed={state.roomStyle.wall === i} aria-label={`${w.name} walls`} onClick={() => { setWallStyle(i); haptic.light(); }}>
                          <span className="hqb__sw-chip" style={{ background: dark ? w.dark : w.light }} />
                          <span className="hqb__sw-name">{w.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
              {placingType && (
                <div className="hqb__placing">
                  <span className="hqb__placing-text">Placing <b>{furnitureDef(placingType).name}</b> — tap the floor</span>
                  <div className="hqb__row">
                    <button className="hqb__tool" onClick={() => { setPlaceRot((r) => ((r + 1) % 4) as Rot); haptic.light(); }}><RotateCw size={15} /> Rotate</button>
                    <button className="hqb__tool" onClick={() => setPlacingType(null)}><X size={15} /> Cancel</button>
                  </div>
                </div>
              )}
              {visibleItems.length === 0 ? (
                <EmptyState glyph={<Search size={36} strokeWidth={1.6} />} title="No matches" sub={`Nothing in the catalog matches “${search.trim()}”. Try a different word.`} />
              ) : (
                <div className="hqb__items">
                  {visibleItems.map((f) => {
                    const afford = canAffordFurniture(state, f.id);
                    return (
                      <button key={f.id} className={`hqb__item${placingType === f.id ? " hqb__item--on" : ""}${afford ? "" : " hqb__item--poor"}`} aria-pressed={placingType === f.id} aria-label={`Buy ${f.name}, ${format(dollars(f.cost))}`} onClick={() => pick(f.id)}>
                        <span className="hqb__item-glyph"><FurnitureThumb id={f.id} size={48} /></span>
                        <span className="hqb__item-name">{f.name}</span>
                        <span className="hqb__item-price tnum">{format(dollars(f.cost))}</span>
                        {(f.attrs?.comfort || f.attrs?.focus || f.attrs?.inspiration) ? (
                          <span className="hqb__item-attrs">
                            {f.attrs?.comfort ? <span className="hqb__attr hqb__attr--c"><Smile size={10} aria-hidden />{f.attrs.comfort}</span> : null}
                            {f.attrs?.focus ? <span className="hqb__attr hqb__attr--f"><Crosshair size={10} aria-hidden />{f.attrs.focus}</span> : null}
                            {f.attrs?.inspiration ? <span className="hqb__attr hqb__attr--i"><Sparkles size={10} aria-hidden />{f.attrs.inspiration}</span> : null}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
                </>
              )}
            </>
          )}
        </div>
      )}
      <DecorateTutorial open={tutorial} onClose={() => { setTutorial(false); setSettings({ decorateTutorialSeen: true }); }} />
    </Card>
  );
}

function Upgrades() {
  const { state, buyUpgrade, upgradeHQ } = useGame();
  const fac = facility(state);
  const nextFac = BALANCE.facilities[state.facilityTier];

  // Purchase celebration: the bought card blooms (ring + accent wash), the new pip ignites,
  // and the effect line rises out of the card — the moment should FEEL like installing
  // something real, not a silent counter bump. `n` re-keys the burst/pip so a rapid second
  // buy restarts their animations.
  const [boom, setBoom] = useState<{ id: string; tier: number; text: string; n: number } | null>(null);
  const boomTimer = useRef<number | null>(null);
  useEffect(() => () => { if (boomTimer.current !== null) window.clearTimeout(boomTimer.current); }, []);
  const celebrate = (id: string, tier: number, text: string) => {
    setBoom({ id, tier, text, n: Date.now() });
    if (boomTimer.current !== null) window.clearTimeout(boomTimer.current);
    boomTimer.current = window.setTimeout(() => setBoom(null), 1200);
    haptic.success();
    sfx("upgrade");
  };

  // Overall progression — every tier bought across all lines + facility moves.
  const builtTiers =
    UPGRADE_LINES.reduce((a, l) => a + (state.upgrades[l.id] ?? 0), 0) + (state.facilityTier - 1);
  const maxTiers =
    UPGRADE_LINES.reduce((a, l) => a + l.maxTier, 0) + (BALANCE.facilities.length - 1);
  const pct = Math.round((builtTiers / maxTiers) * 100);

  return (
    <>
      <SectionHeader title="Grow your company" accessory="upgrades" />

      <Card className="hqu__power">
        <div className="hqu__power-head">
          <span className="hqu__power-title">Company power</span>
          <span className="hqu__power-val tnum">{builtTiers}<span className="hqu__power-max">/{maxTiers}</span></span>
        </div>
        <div className="hqu__power-track">
          <div className="hqu__power-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="hqu__power-sub">Every upgrade compounds across all the products you ship.</p>
      </Card>

      {/* Facility (the headquarters itself) */}
      <Card className={`hqu__fac${boom?.id === "facility" ? " hqu__card--boom" : ""}`}>
        {boom?.id === "facility" && <span key={boom.n} className="hqu__burst" aria-hidden>{boom.text}</span>}
        <div className="hqu__card-head">
          <span className="hqu__glyph hqu__glyph--fac" aria-hidden><Users size={18} /></span>
          <div className="hqu__info">
            <span className="hqu__name">{fac.name}</span>
            <span className="hqu__effect">{state.staff.length}/{fac.staffCapacity} desks · {format(fac.weeklyRent)}/wk rent</span>
          </div>
          <span className="hqu__lv tnum">Tier {state.facilityTier}</span>
        </div>
        {nextFac ? (
          <Button
            block
            size="sm"
            variant={state.cash >= nextFac.upgradeCost ? "primary" : "tertiary"}
            disabled={state.cash < nextFac.upgradeCost}
            onClick={() => { upgradeHQ(); celebrate("facility", 0, `${nextFac.name} · ${nextFac.staffCapacity} desks`); }}
          >
            <ArrowUp size={14} /> Move to {nextFac.name} · {format(nextFac.upgradeCost)}
          </Button>
        ) : (
          <div className="hqu__maxed"><Check size={14} strokeWidth={2.5} /> Largest facility</div>
        )}
      </Card>

      {/* Seats now come from placed desks, bought in the Decorate shop above — every desk you
          set down is a seat a new hire sits at. This is just the pointer there. */}
      <Card className="hqu__fac hqu__seats-hint">
        <div className="hqu__card-head">
          <span className="hqu__glyph" aria-hidden><Monitor size={18} /></span>
          <div className="hqu__info">
            <span className="hqu__name">Need more seats?</span>
            <span className="hqu__effect">Buy a desk in <strong>Decorate</strong> — each one seats another hire.</span>
          </div>
          <span className="hqu__lv tnum">{deskCapacity(state)} {deskCapacity(state) === 1 ? "seat" : "seats"}</span>
        </div>
      </Card>

      {/* Office upgrade lines — colour-coded by function, glowing tier pips. */}
      <div className="hqu__grid">
        {UPGRADE_LINES.map((line) => {
          const cur = state.upgrades[line.id] ?? 0;
          const cost = upgradeCost(state, line.id);
          const maxed = cur >= line.maxTier;
          // The advanced tiers are research-gated: locked (masked grey) until the team finishes
          // the prerequisite project. Shown so the player SEES the aspirational tier to work toward.
          const gate = maxed ? null : upgradeGate(state, line.id);
          const affordable = cost !== null && state.cash >= cost && !gate;
          const Icon = UPGRADE_ICONS[line.icon] ?? Cpu;
          const fn = UPGRADE_FN[line.id];
          const boomed = boom?.id === line.id;
          return (
            <Card
              key={line.id}
              className={`hqu__card${boomed ? " hqu__card--boom" : ""}${gate ? " hqu__card--locked" : ""}`}
              style={{ "--accent": fn.accent, "--accent-soft": fn.soft } as CSSProperties}
            >
              {boomed && <span key={boom.n} className="hqu__burst" aria-hidden>{boom.text}</span>}
              <div className="hqu__card-head">
                <span className="hqu__glyph" aria-hidden>{gate ? <Lock size={16} /> : <Icon size={18} />}</span>
                <div className="hqu__info">
                  <span className="hqu__name">{line.name}</span>
                  <span className="hqu__effect">{cur > 0 ? line.effectAt(cur) : line.blurb}</span>
                  {!maxed && <span className="hqu__effect-next">→ {line.effectAt(cur + 1)}</span>}
                </div>
                <span className="hqu__lv tnum">{maxed ? "MAX" : `Lv ${cur}`}</span>
              </div>
              <div className="hqu__pips">
                {Array.from({ length: line.maxTier }).map((_, i) => (
                  <span
                    key={boomed && i === boom.tier - 1 ? `ignite${boom.n}` : i}
                    className={`hqu__pip${i < cur ? " hqu__pip--on" : ""}${boomed && i === boom.tier - 1 ? " hqu__pip--ignite" : ""}`}
                  />
                ))}
              </div>
              {maxed ? (
                <div className="hqu__maxed"><Check size={14} strokeWidth={2.5} /> Fully upgraded</div>
              ) : gate ? (
                <div className="hqu__locked">
                  <Lock size={13} strokeWidth={2.5} aria-hidden />
                  <span>Research <strong>{projectById(gate).name}</strong> to unlock {line.tierNames[cur]}</span>
                </div>
              ) : (
                <Button
                  block
                  size="sm"
                  variant={affordable ? "primary" : "tertiary"}
                  disabled={!affordable}
                  onClick={() => { buyUpgrade(line.id); celebrate(line.id, cur + 1, line.effectAt(cur + 1)); }}
                >
                  <ArrowUp size={14} /> {line.tierNames[cur]} · {cost !== null ? format(cost) : "—"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}


/** Progress bar strip used inside the era goal card. */
function GoalBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, target > 0 ? Math.round((value / target) * 100) : 0);
  return (
    <div className="hq__goalbar">
      <div className="hq__goalbar-head">
        <span className="hq__goalbar-label">{label}</span>
        <span className="hq__goalbar-val tnum">{pct}%</span>
      </div>
      <div className="hq__goalbar-track">
        <div className="hq__goalbar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Compact card showing what's needed to advance to the next era (or reach IPO). */
function EraGoalCard({ state }: { state: GameState }) {
  if (state.era >= maxEra()) {
    if (state.wentPublic) return null;
    const repNeeded = BALANCE.ipo.minReputation - state.reputation;
    if (repNeeded <= 0) return null;
    return (
      <div className="hq__goal hq__goal--card">
        <div className="hq__goal-head">
          <span className="hq__goal-label">IPO goal</span>
          <span className="hq__goal-era">{BALANCE.ipo.minReputation} reputation</span>
        </div>
        <GoalBar label="Reputation" value={state.reputation} target={BALANCE.ipo.minReputation} />
      </div>
    );
  }
  const eraDef = BALANCE.eras.find((e) => e.era === state.era);
  if (!eraDef) return null;
  const repNeeded = eraDef.repToAdvance - state.reputation;
  const revThresholdTarget = eraDef.revToAdvance as unknown as number;
  const revDollars = toDollars(state.cumulativeRevenue);
  const revTargetDollars = Number.isFinite(revThresholdTarget) ? revThresholdTarget / 100 : Infinity;
  const revNeeded = Number.isFinite(revTargetDollars) ? revTargetDollars - revDollars : Infinity;
  // Era 1→2 needs EITHER threshold; era 2+ needs BOTH (eras.ts) — hide the card only when the
  // actual gate is satisfied, otherwise the roadmap vanishes the moment one bar fills.
  const eitherGate = state.era === 1;
  if (eitherGate ? repNeeded <= 0 || revNeeded <= 0 : repNeeded <= 0 && revNeeded <= 0) return null;
  return (
    <div className="hq__goal hq__goal--card">
      <div className="hq__goal-head">
        <span className="hq__goal-label">Next era</span>
        <span className="hq__goal-era">{eraName(state.era + 1)}</span>
      </div>
      {Number.isFinite(eraDef.repToAdvance) && (
        <GoalBar label={`Reputation (need ${Math.round(eraDef.repToAdvance)})`} value={state.reputation} target={eraDef.repToAdvance} />
      )}
      {Number.isFinite(revTargetDollars) && (
        <GoalBar label={`Revenue (need ${formatShortDollars(revTargetDollars)})`} value={revDollars} target={revTargetDollars} />
      )}
      <p className="hq__goal-or">
        {eitherGate ? "Either threshold unlocks the next era." : "Both thresholds are required to advance."}
      </p>
      {Number.isFinite(revTargetDollars) && (() => {
        const wkRev = toDollars(nextWeekRevenue(state));
        if (wkRev <= 0 || revDollars >= revTargetDollars) return null;
        const weeksLeft = Math.ceil((revTargetDollars - revDollars) / wkRev);
        if (weeksLeft > 200) return null;
        return <p className="hq__goal-eta">~{weeksLeft} week{weeksLeft !== 1 ? "s" : ""} at current revenue</p>;
      })()}
    </div>
  );
}

const INSIGHT_STAT_LABEL: Record<string, string> = {
  performance: "Performance", quality: "Quality", battery: "Battery",
  design: "Design", ecosystem: "Ecosystem",
};

function StrategicInsightsCard({ state, onNavigate }: { state: GameState; onNavigate: (t: Tab) => void }) {
  type Insight = { icon: LucideIcon; text: string; tab?: Tab };
  const insights: Insight[] = [];

  // 1. Idle staff — most immediately actionable
  const idleCount = state.staff.filter((s) => s.assignment === "idle").length;
  if (idleCount > 0) {
    insights.push({
      icon: Users,
      text: `${idleCount} staff member${idleCount > 1 ? "s are" : " is"} unassigned — assign them to R&D or Marketing to compound output.`,
      tab: "company",
    });
  }

  // 2. Affordable research project
  const rp = Math.floor(state.researchPoints);
  const nextProject = RESEARCH_PROJECTS
    .filter((p) => !state.completedProjects.includes(p.id) && p.era <= state.era && p.rpCost <= rp)
    .sort((a, b) => a.rpCost - b.rpCost)[0];
  if (nextProject) {
    insights.push({
      icon: FlaskConical,
      text: `You have ${rp} RP — enough to unlock "${nextProject.name}". Head to Research to claim it.`,
      tab: "research",
    });
  }

  // 3. Product drought — no active products and nothing in the pipeline
  const active = state.launched.filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length);
  const inPipeline = state.building.length > 0 || state.ready.length > 0;

  // 2b. Breakout coaching — the recent launches keep landing "steady" and never break out. Read the
  // latest launch's recorded drivers and name the ONE biggest lever, so a stuck player gets a
  // specific, proactive nudge toward their first "solid"/hit instead of grinding identical sellers.
  if (insights.length < 3 && state.launched.length >= 2) {
    const recent = state.launched.slice(0, 3); // newest first (prepended on launch)
    const brokeOut = recent.some((lp) => lp.verdict === "hit" || lp.verdict === "solid");
    const ins = state.launched.find((lp) => lp.insight)?.insight;
    if (!brokeOut && ins) {
      const hasMarketer = state.staff.some((s) => s.assignment === "marketing");
      if (ins.betterRivals >= 1) {
        insights.push({
          icon: FlaskConical,
          text: 'Your launches keep landing "steady" because rivals outclass them — raise component tiers in R&D to break out with a "solid" or a hit.',
          tab: "research",
        });
      } else if (ins.hype < 1.15) {
        insights.push(
          hasMarketer
            ? { icon: Megaphone, text: 'Your products sell steadily but lack buzz — add a launch campaign to push the next one past "steady".', tab: "market" }
            : { icon: Megaphone, text: 'Your products sell steadily but lack buzz — put someone on Marketing to lift launch hype and break past "steady".', tab: "company" },
        );
      } else if (ins.demandFit < 45) {
        insights.push({
          icon: TrendingUp,
          text: 'Your launches keep just missing the trend — check Market demand before your next design to land a "solid".',
          tab: "market",
        });
      }
    }
  }

  if (insights.length < 3) {
    if (active.length === 0 && !inPipeline) {
      insights.push({
        icon: Rocket,
        text: "All products have finished their run — design and launch a new one to keep revenue flowing.",
        tab: "design",
      });
    }
  }

  // 3b. Products ending soon — warn the player to start designing a successor
  if (insights.length < 3 && !inPipeline) {
    const endingSoon = active.filter((lp) => (lp.weeklyUnits.length - lp.weeksElapsed) <= 4);
    if (endingSoon.length > 0) {
      const name = endingSoon.length === 1 ? endingSoon[0].product.name : `${endingSoon.length} products`;
      insights.push({
        icon: Clock,
        text: `${name} ${endingSoon.length === 1 ? "finishes" : "finish"} selling in ≤4 weeks — start a successor now to keep revenue continuous.`,
        tab: "design",
      });
    }
  }

  // 3c. Low staff morale
  if (insights.length < 3 && state.staff.length > 0) {
    const unhappy = state.staff.filter((s) => s.mood < 28);
    if (unhappy.length > 0) {
      insights.push({
        icon: Users,
        text: `${unhappy[0].name} has very low morale (${Math.round(unhappy[0].mood)}%) — upgrade Amenities or reduce workload to prevent an output slump.`,
        tab: "company",
      });
    }
  }

  // 3d. Affordable HQ upgrade
  if (insights.length < 3) {
    const affordableUpgrade = UPGRADE_LINES.find((line) => {
      const cur = state.upgrades[line.id] ?? 0;
      if (cur >= line.maxTier) return false;
      const cost = upgradeCost(state, line.id);
      return cost !== null && state.cash >= cost;
    });
    if (affordableUpgrade) {
      const cur = state.upgrades[affordableUpgrade.id] ?? 0;
      const cost = upgradeCost(state, affordableUpgrade.id)!;
      insights.push({
        icon: ArrowUp,
        text: `Your ${affordableUpgrade.name} can be upgraded to "${affordableUpgrade.tierNames[cur]}" for ${format(cost)} — unlocks ${affordableUpgrade.effectAt(cur + 1)}.`,
      });
    }
  }

  // 4. Rising market trend worth exploiting
  if (insights.length < 3) {
    const top = [...STAT_KEYS].sort((a, b) => {
      const da = (state.trends.targetWeights[a] ?? 0) - (state.trends.weights[a] ?? 0);
      const db = (state.trends.targetWeights[b] ?? 0) - (state.trends.weights[b] ?? 0);
      return db - da;
    })[0];
    const topDelta = top ? (state.trends.targetWeights[top] ?? 0) - (state.trends.weights[top] ?? 0) : 0;
    if (top && topDelta > 0.025) {
      insights.push({
        icon: TrendingUp,
        text: `${INSIGHT_STAT_LABEL[top]} demand is climbing — your next product should prioritize it to ride the wave.`,
        tab: "design",
      });
    }
  }

  // 5. Untapped category (blue-ocean opportunity)
  if (insights.length < 3) {
    const shippedCats = new Set(state.launched.map((lp) => lp.product.category));
    const unshipped = CATEGORY_LIST.filter((c) => c.unlockEra <= state.era && !shippedCats.has(c.id));
    if (unshipped.length > 0) {
      insights.push({
        icon: Shapes,
        text: `You haven't shipped a ${unshipped[0].displayName} yet — an open market segment with no competition from you.`,
        tab: "design",
      });
    }
  }

  // 6. Rival gaining strength in a category you're actively selling in
  if (insights.length < 3) {
    let threatComp: (typeof state.competitors)[0] | null = null;
    let threatCat: CategoryId | null = null;
    for (const comp of state.competitors) {
      for (const [cat, str] of Object.entries(comp.strengthByCategory)) {
        if (active.some((lp) => lp.product.category === cat) && (str ?? 0) >= 45) {
          threatComp = comp;
          threatCat = cat as CategoryId;
          break;
        }
      }
      if (threatComp) break;
    }
    if (threatComp && threatCat) {
      const catDef = CATEGORY_LIST.find((c) => c.id === threatCat);
      const strength = Math.round(threatComp.strengthByCategory[threatCat] ?? 0);
      insights.push({
        icon: TrendingDown,
        text: `${threatComp.name} (strength ${strength}) is a strong rival in ${catDef?.displayName ?? threatCat}s — spec up your next launch to stay ahead.`,
        tab: "market",
      });
    }
  }

  // 7. Open desks + healthy runway = good time to hire
  if (insights.length < 3 && state.staff.length >= 1) {
    const facH = facility(state);
    const openDesks = facH.staffCapacity - state.staff.length;
    const wkBurnH = burn(state);
    const wkRevH = nextWeekRevenue(state);
    const runwayH = runwayWeeks(state.cash, wkBurnH, wkRevH);
    if (openDesks >= 1 && runwayH > 30) {
      insights.push({
        icon: Users,
        text: `${openDesks} desk${openDesks > 1 ? "s" : ""} open and ${runwayH === Infinity ? "you are profitable" : `${runwayH}+ weeks of runway`} — a strong time to recruit.`,
        tab: "company",
      });
    }
  }

  // 8. No marketer on team while launching products — missing hype boost
  if (insights.length < 3 && state.staff.length >= 2) {
    const hasAnyMarketer = state.staff.some((s) => s.assignment === "marketing");
    const hasLaunched = state.launched.length > 0;
    if (!hasAnyMarketer && hasLaunched) {
      insights.push({
        icon: Megaphone,
        text: "No one is assigned to Marketing — each launch is missing a hype bonus that boosts sales velocity. Assign a team member or hire a marketer.",
        tab: "company",
      });
    }
  }

  // 9. All launched products are in decline — prompt a new launch
  if (insights.length < 3 && active.length > 0 && !inPipeline) {
    const peakWk = BALANCE.sales.peakWeek;
    const allDecline = active.every((lp) => lp.weeksElapsed > peakWk);
    if (allDecline) {
      insights.push({
        icon: Rocket,
        text: `All ${active.length === 1 ? "your active product has" : `${active.length} active products have`} passed their sales peak — launch something new now to capture fresh demand before revenue fades.`,
        tab: "design",
      });
    }
  }

  if (insights.length === 0) return null;

  return (
    <Card className="hq__insights">
      <SectionHeader title="Strategic insights" accessory={`${insights.length} hint${insights.length > 1 ? "s" : ""}`} />
      <div className="hq__insights-list">
        {insights.slice(0, 3).map((ins) => {
          const Icon = ins.icon;
          return (
            <button
              key={ins.text}
              className={`hq__insight${ins.tab ? "" : " hq__insight--static"}`}
              onClick={() => ins.tab && onNavigate(ins.tab)}
              disabled={!ins.tab}
            >
              <span className="hq__insight-icon"><Icon size={14} strokeWidth={2.5} /></span>
              <span className="hq__insight-text">{ins.text}</span>
              {ins.tab && <ChevronRight size={13} className="hq__insight-chevron" aria-hidden />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function FeedCard({ feed, week, onNavigate }: { feed: FeedItem[]; week: number; onNavigate: (t: Tab) => void }) {
  const [expanded, setExpanded] = useState(false);
  const all = [...feed].reverse();
  const limit = 4;
  const shown = expanded ? all : all.slice(0, limit);
  const hasMore = all.length > limit;
  return (
    <Card>
      <SectionHeader title="News" accessory={`week ${week}`} />
      <ul className="hq__feed-list">
        {shown.map((item) => {
          const Icon = item.tone === "positive" ? TrendingUp : item.tone === "negative" ? TrendingDown : item.tone === "accent" ? Sparkles : Newspaper;
          return (
            <li key={item.id} className={`hq__feed-item hq__feed-item--${item.tone}`}>
              <span className="hq__feed-icon" aria-hidden><Icon size={11} strokeWidth={2.5} /></span>
              <span className="hq__feed-week">wk {item.week}</span>
              {item.text}
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button className="hq__feed-toggle" onClick={() => setExpanded((x) => !x)}>
          {expanded ? "Show recent" : `+${all.length - limit} older events`}
        </button>
      )}
      <Button block variant="secondary" onClick={() => onNavigate("market")}>View the market</Button>
    </Card>
  );
}

function PerformanceCard({ state, onNavigate }: { state: GameState; onNavigate: (t: Tab) => void }) {
  if (state.launched.length === 0) return null;
  const hits = state.launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
  const flops = state.launched.filter((lp) => lp.verdict === "flop").length;
  const hitRate = Math.round((hits / state.launched.length) * 100);
  const active = state.launched.filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length);
  const weeklyRevenue = active.reduce((s, lp) => s + lp.weeklyUnits[lp.weeksElapsed] * toDollars(lp.product.price), 0);
  // 4-week revenue forecast (wk 0 = this week, 1–3 = ahead)
  const forecast = Array.from({ length: 4 }, (_, i) =>
    active.reduce((sum, lp) => {
      const idx = lp.weeksElapsed + i;
      return sum + (idx < lp.weeklyUnits.length ? lp.weeklyUnits[idx] * toDollars(lp.product.price) : 0);
    }, 0),
  );
  const forecastPeak = Math.max(...forecast, 1);
  const nextWeekRev = forecast[1] ?? 0;
  const revDeltaPct = weeklyRevenue > 0 ? Math.round(((nextWeekRev - weeklyRevenue) / weeklyRevenue) * 100) : 0;
  const revTrending = revDeltaPct > 2 ? "up" : revDeltaPct < -2 ? "down" : "flat";
  const best = state.launched.reduce<(typeof state.launched)[0] | null>(
    (top, lp) => (top === null || lp.revenueToDate > top.revenueToDate ? lp : top),
    null,
  );
  return (
    <Card>
      <SectionHeader title="Performance" accessory={`wk ${state.week}`} />
      <div className="hq__perf-grid">
        <div className="hq__perf-item">
          <span className="hq__perf-val tnum">{state.launched.length}</span>
          <span className="hq__perf-label">Shipped</span>
        </div>
        <div className="hq__perf-item">
          <span className="hq__perf-val tnum hq__perf-val--positive">{hits}</span>
          <span className="hq__perf-label">Hits</span>
        </div>
        <div className="hq__perf-item">
          <span className="hq__perf-val tnum hq__perf-val--negative">{flops}</span>
          <span className="hq__perf-label">Flops</span>
        </div>
        <div className="hq__perf-item">
          <span className="hq__perf-val tnum">{active.length}</span>
          <span className="hq__perf-label">Active</span>
        </div>
        <div className="hq__perf-item">
          <span className={`hq__perf-val tnum${hitRate >= 60 ? " hq__perf-val--positive" : hitRate <= 30 && state.launched.length >= 3 ? " hq__perf-val--negative" : ""}`}>
            {hitRate}%
          </span>
          <span className="hq__perf-label">Hit rate</span>
        </div>
      </div>
      {weeklyRevenue > 0 && (
        <div className="hq__perf-revenue">
          {revTrending === "up" ? <TrendingUp size={12} aria-hidden className="hq__rev-arrow hq__rev-arrow--up" /> : revTrending === "down" ? <TrendingDown size={12} aria-hidden className="hq__rev-arrow hq__rev-arrow--down" /> : <span className="hq__rev-flat" aria-hidden>—</span>}
          <span>{formatShortDollars(weeklyRevenue)}/wk</span>
          {revDeltaPct !== 0 && (
            <span className={`hq__rev-delta tnum${revTrending === "up" ? " hq__rev-delta--up" : revTrending === "down" ? " hq__rev-delta--down" : ""}`}>
              {revDeltaPct > 0 ? "+" : ""}{revDeltaPct}% next wk
            </span>
          )}
          <span className="hq__rev-sub">{active.length} active product{active.length > 1 ? "s" : ""}</span>
        </div>
      )}
      {active.length > 0 && (
        <div className="hq__forecast" aria-label="4-week revenue forecast">
          {forecast.map((rev, i) => (
            <div key={i} className="hq__forecast-col">
              <div className="hq__forecast-bar-wrap">
                <div
                  className="hq__forecast-bar"
                  style={{ height: `${Math.round((rev / forecastPeak) * 100)}%`, opacity: i === 0 ? 1 : 0.6 + i * 0.0 }}
                />
              </div>
              <span className="hq__forecast-label tnum">{i === 0 ? "Now" : `+${i}`}</span>
            </div>
          ))}
        </div>
      )}
      {best && (
        <button className="hq__perf-best" onClick={() => onNavigate("market")}>
          <span className="hq__perf-best-label">Best performer</span>
          <span className="hq__perf-best-name">{best.product.name}</span>
          <span className="hq__perf-best-rev tnum">{format(best.revenueToDate)}</span>
        </button>
      )}
    </Card>
  );
}
