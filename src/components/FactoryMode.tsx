// Factory Mode — the player's own 3D factory floor: Current Order + Factory Stats panels, a
// right tool rail (Build/Upgrades/Research/Stats), BOOST (the real rushBuild lever), truck and
// Shop along the bottom. Fully data-driven off the live sim. The floor starts bare (Intake +
// Packer); the player wires it by hand (tap / drag-paint / hold-to-move) or pays the Auto
// router, then deepens the earned build-speed bonus with recipe machines, arms and upgrades.
// Parametric SVG only (zero image assets); every animation sim-gated + reduced-motion safe.
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp, BarChart3, BatteryCharging, Bookmark, Bot, Boxes, Camera, Check, ChevronDown, CodeXml, Cpu, Drill, Eraser,
  FlaskConical, Hammer, HelpCircle, Layers3, Locate, Lock, Maximize2, Monitor, MonitorSmartphone, Move3d,
  Container, Library, PackageCheck, Palette, RotateCw, ScanLine, ShoppingCart, Sprout, Stamp,
  TrafficCone, Trash2, TriangleAlert, Truck, Waypoints, Wrench, X, Zap, type LucideIcon,
} from "lucide-react";
import { useGame } from "../state/useGame.tsx";
import { burn, industryRank, nextWeekRevenue, nextExpansionCost, factoryLayoutCost, autoConnectQuote } from "../state/gameState.ts";
import { MAX_LAYOUTS, layoutDiff } from "../engine/factoryLayout.ts";
import { appOverlayOpen } from "../design/overlayGuard.ts";
import { lockScroll } from "../design/scrollLock.ts";
import { factoryFor, DEFAULT_FACTORY_ID, FACTORIES } from "../engine/factories.ts";
import { nextUpgradeCost, upgradeLockedBy, upgradeLine } from "../engine/upgrades.ts";
import { projectById } from "../engine/research.ts";
import { CATEGORIES } from "../engine/catalogs.ts";
import { format, sub, toDollars } from "../engine/money.ts";
import type { ComponentKind, FactoryId } from "../engine/types.ts";
import type { Tab } from "./BottomNav.tsx";
import { StageTrail } from "./BuildProgress.tsx";
import { stageForLine } from "../engine/assemblyLine.ts";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { Sheet, useDialogFocus } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { webglSupported, prefersReducedMotion } from "../garage3d/support.ts";
import { EXPAND_STEP, FLOOR, MACHINE_DEFS, MAX_EXPANSION, BELT_COST, beltChain, canPlaceMachine, floorWidth, lineComplete, lineSpeedMult, machineCells, missingMachineKinds, type BeltDir, type FactoryFloor as GameFloor, type MachineKind } from "../engine/factoryFloor.ts";
import { requiredKindsFor } from "../engine/assemblyLine.ts";
import { PROP_DEFS, propCellSet, type PropKind } from "../engine/factoryProps.ts";
import { sideOrderPayout, SIDE_ORDER_CANCEL_PCT } from "../engine/sideOrders.ts";
import { useSettings, getSettings, setSettings } from "../state/settings.ts";
import { FactoryTutorial } from "./FactoryTutorial.tsx";

// three.js stays in its own lazy chunk (the garage3d rule); the SVG map is the fallback for
// no-WebGL / reduced-motion / 3D-off, and the Suspense placeholder while the chunk loads.
const Factory3D = lazy(() => import("./Factory3D.tsx"));
import "./factoryMode.css";

/* ------------------------------- shared data ------------------------------- */

const MATERIAL_ICONS: Record<ComponentKind, typeof Cpu> = {
  chip: Cpu, display: Monitor, battery: BatteryCharging,
  materials: Layers3, software: CodeXml, camera: Camera,
};

// Build-palette icons + short labels, so the toolbar reads as tiles, not a wall of text.
const MACHINE_ICONS: Record<MachineKind, LucideIcon> = {
  intake: Boxes, mill: Drill, press: Stamp, screen: MonitorSmartphone, arm: Bot, qa: ScanLine, packer: PackageCheck,
};
const MACHINE_SHORT: Record<MachineKind, string> = {
  intake: "Intake", mill: "Mill", press: "Press", screen: "Screen", arm: "Arm", qa: "Test", packer: "Packer",
};
const DIR_ROT: Record<BeltDir, number> = { n: 0, e: 90, s: 180, w: 270 };

const PROP_ICONS: Record<PropKind, LucideIcon> = {
  crates: Boxes, barrel: Container, pallet: Layers3, plant: Sprout,
  bench: Wrench, rack: Library, cone: TrafficCone, sign: TriangleAlert,
};

// Factory building decor palettes — parametric colours (3D uses intrinsic colours, not theme
// tokens). Indices are stored in state.factoryDecor so the paint job persists.
const FACTORY_WALLS: { name: string; hex: string }[] = [
  { name: "Slate", hex: "#8a9099" }, { name: "Ocean", hex: "#4a6fa5" }, { name: "Forest", hex: "#4f8f6b" },
  { name: "Sand", hex: "#b4966a" }, { name: "Charcoal", hex: "#484d55" }, { name: "Chalk", hex: "#d6dae0" },
];
const FACTORY_FLOORS: { name: string; hex: string }[] = [
  { name: "Concrete", hex: "#7c828c" }, { name: "Warm", hex: "#8a7f6f" }, { name: "Cool", hex: "#6d7885" },
  { name: "Graphite", hex: "#565b63" }, { name: "Pale", hex: "#9aa1a9" },
];

function useFactoryData() {
  const game = useGame();
  const { state } = game;
  const lead = state.building[0] ?? null;
  // A running client commission keeps the LINE alive too — belts roll, machines work.
  const active = state.building.length > 0 || !!state.activeSideOrder;
  const progress = lead ? Math.min(1, lead.weeksElapsed / Math.max(1, lead.totalWeeks)) : 0;
  const stage = lead ? stageForLine(lead.product.category, progress) : null;
  const activeKind = stage ? stage.kind : null;
  const weeksLeft = lead ? Math.max(0, Math.ceil(lead.totalWeeks - lead.weeksElapsed)) : 0;
  const readyCount = state.ready.length;
  const liveProducts = state.launched.filter((l) => l.weeksElapsed < l.weeklyUnits.length);
  const selling = liveProducts.length > 0;

  const facId = (lead?.product.factoryId ?? state.ownedFactories[0] ?? DEFAULT_FACTORY_ID) as FactoryId;
  const fac = factoryFor(facId);
  const weeklyLoad = state.building.reduce((sum, b) => sum + (b.plannedUnits ?? 0) / Math.max(1, b.totalWeeks), 0);
  const util = Number.isFinite(fac.capacityPerWeek) && fac.capacityPerWeek > 0 ? weeklyLoad / fac.capacityPerWeek : null;
  const overtime = util != null && util > 1;
  const robotTier = state.upgrades.assembly ?? 0;

  // Factory stats — per week, because that IS the sim (no invented per-minute numbers).
  const unitsWk = liveProducts.reduce((a, l) => a + (l.weeklyUnits[l.weeksElapsed] ?? 0), 0);
  const revenueWk = nextWeekRevenue(state);
  const expensesWk = burn(state);
  const profitWk = sub(revenueWk, expensesWk);

  // Raw materials — parts committed to active runs, per component kind of each product.
  const materials = new Map<ComponentKind, number>();
  for (const b of state.building) {
    const remaining = Math.round((b.plannedUnits ?? 0) * (1 - b.weeksElapsed / Math.max(1, b.totalWeeks)));
    for (const kind of CATEGORIES[b.product.category].slots) {
      materials.set(kind, (materials.get(kind) ?? 0) + remaining);
    }
  }

  // How the player-built line affects build time — the reward for a well-equipped, connected floor.
  // Product-aware: the current order's recipe decides which machines grow the bonus, so a phone
  // floor wants a screen bonder, a laptop floor a mill (no order → the neutral view).
  const leadCategory = lead?.product?.category;
  const reqKinds = leadCategory ? requiredKindsFor(leadCategory) : undefined;
  const lineSpeed = lineSpeedMult(state.factoryFloor, reqKinds); // <1 = earned bonus, 1 = neutral (never >1)
  const linePct = Math.round((1 - lineSpeed) * 100);   // % faster the wired line builds
  const missing = reqKinds ? missingMachineKinds(state.factoryFloor, reqKinds) : [];

  return {
    game, state, lead, active, progress, stage, activeKind, weeksLeft, readyCount, selling,
    fac, util, overtime, robotTier, unitsWk, revenueWk, expensesWk, profitWk, materials,
    floor: state.factoryFloor, lineSpeed, linePct, missing,
  };
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* --------------------- layout-driven minimap (SVG, zero assets) --------------------- */
/* Renders the PLAYER'S floor — belts coloured by whether they're part of the running chain,
   machines by kind — so the card and the no-WebGL fallback always tell the truth (F3.5).
   Replaces the old hand-drawn map, which showed a hardcoded line regardless of the layout. */

const MACHINE_TINT: Record<MachineKind, string> = {
  intake: "var(--fmini-intake)",
  mill: "var(--fmini-mill)",
  press: "var(--fmini-press)",
  screen: "var(--fmini-screen)",
  arm: "var(--fmini-arm)",
  qa: "var(--fmini-qa)",
  packer: "var(--fmini-packer)",
};

export function FloorMinimap({ floor, lineOk, running, floorW = FLOOR.w, lockedBayW = 0 }: { floor: GameFloor; lineOk: boolean; running: boolean; floorW?: number; lockedBayW?: number }) {
  const K = 20; // px per cell
  // The viewBox tracks the buildable width so expansion bays (columns ≥16) aren't clipped off-canvas.
  const W = Math.max(FLOOR.w, floorW) * K;
  const H = FLOOR.h * K;
  // The NEXT (unbought) bay shows as a dimmed, padlocked strip — see the bigger factory, want it.
  const LW = lockedBayW * K;
  const lockX = W + LW / 2, lockY = H / 2 - 8;
  const chain = new Set(beltChain(floor.belts).map((b) => `${b.c},${b.r}`));
  return (
    <svg className={`fmini${running ? " fmini--run" : ""}`} viewBox={`0 0 ${W + LW} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
      aria-label={lineOk ? "Factory layout, line connected" : "Factory layout, line incomplete"}>
      <rect x={0} y={0} width={W} height={H} rx={10} className="fmini__pad" />
      {lockedBayW > 0 && (
        <g className="fmini__lockbay" aria-hidden>
          <rect x={W + 3} y={2} width={LW - 5} height={H - 4} rx={8} className="fmini__lockbay-pad" />
          <rect x={lockX - 7} y={lockY - 1} width={14} height={12} rx={3} className="fmini__lockbay-body" />
          <path d={`M ${lockX - 4.5} ${lockY - 1} v -3.5 a 4.5 4.5 0 0 1 9 0 v 3.5`} className="fmini__lockbay-shackle" />
          <text x={lockX} y={lockY + 24} textAnchor="middle" className="fmini__lockbay-txt">Locked</text>
        </g>
      )}
      {Array.from({ length: Math.round(W / K) - 1 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * K} y1={0} x2={(i + 1) * K} y2={H} className="fmini__grid" />
      ))}
      {Array.from({ length: FLOOR.h - 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={(i + 1) * K} x2={W} y2={(i + 1) * K} className="fmini__grid" />
      ))}
      {floor.belts.map((b) => (
        <rect
          key={`${b.c},${b.r}`}
          x={b.c * K + 2} y={b.r * K + 2} width={K - 4} height={K - 4} rx={4}
          className={`fmini__belt${chain.has(`${b.c},${b.r}`) ? (lineOk ? " fmini__belt--live" : " fmini__belt--broken") : ""}`}
        />
      ))}
      {floor.machines.map((m) => {
        const def = MACHINE_DEFS[m.kind];
        return (
          <rect
            key={m.id}
            x={m.c * K + 1.5} y={m.r * K + 1.5} width={def.w * K - 3} height={def.d * K - 3} rx={5}
            className="fmini__machine" style={{ fill: MACHINE_TINT[m.kind] }}
          />
        );
      })}
    </svg>
  );
}


/* ----------------------------- fullscreen mode ----------------------------- */

export function FactoryMode({ onClose, onNavigate }: { onClose: () => void; onNavigate?: (t: Tab) => void }) {
  const d = useFactoryData();
  const { state } = d;
  const { buyUpgrade } = d.game;
  const [sheet, setSheet] = useState<null | "upgrades" | "stats" | "shop" | "decor">(null);
  const settings = useSettings();
  const [glLost, setGlLost] = useState(false);
  const use3d = settings.garage3d && webglSupported() && !prefersReducedMotion() && !glLost;
  // F2 Build mode — the selected tool paints cells on the 3D pad.
  const [buildTool, setBuildTool] = useState<null | MachineKind | PropKind | "belt" | "erase" | "upgrade">(null);
  const [buildCat, setBuildCat] = useState<"machine" | "decor">("machine");
  const [beltDir, setBeltDir] = useState<BeltDir>("e");
  // Auto quotes BEFORE it spends: first tap arms a Confirm/Cancel strip showing the live price
  // (recomputed each render from the same deterministic router, so quote === charge). Any tool
  // switch disarms it.
  const [autoArmed, setAutoArmed] = useState(false);
  useEffect(() => { setAutoArmed(false); }, [buildTool, buildCat]);
  const [layoutName, setLayoutName] = useState("");
  const [confirmLayout, setConfirmLayout] = useState<string | null>(null); // arms a layout's Apply → shows the diff + Confirm
  const [flash, setFlash] = useState<{ c: number; r: number; ok: boolean; n: number } | null>(null);
  // Tapping the expansion bay buys it directly: first tap arms the pill (confirm), second commits.
  // The arm decays so a stray tap can't leave a live $50K+ trigger sitting on the floor.
  const [expandArm, setExpandArm] = useState(false);
  useEffect(() => {
    if (!expandArm) return;
    const t = setTimeout(() => setExpandArm(false), 4000);
    return () => clearTimeout(t);
  }, [expandArm]);
  // Cancelling a commission forfeits a chunk of the payout — arm the button first so one stray tap
  // can't burn the fee. Decays like the expand arm.
  const [cancelArm, setCancelArm] = useState(false);
  useEffect(() => {
    if (!cancelArm) return;
    const t = setTimeout(() => setCancelArm(false), 4000);
    return () => clearTimeout(t);
  }, [cancelArm]);
  // Disarm the bay whenever the floor actually grows — buying an expansion via the Style sheet
  // would otherwise leave the arm live, so one stray bay tap buys the NEXT tier with no confirm.
  useEffect(() => { setExpandArm(false); }, [state.factoryExpansion]);
  // Panels fold so the floor stays visible on portrait — the scene is the star, not the chrome.
  const [orderOpen, setOrderOpen] = useState(true);
  // Camera: drag/touch to orbit, pinch to zoom (Factory3D owns OrbitControls); the recenter button
  // bumps this to re-frame. A one-time hint teaches the gesture on first open.
  const [resetView, setResetView] = useState(0);
  const [camHint, setCamHint] = useState(false);
  // First-run Factory coach — shown once, the first time the player opens Factory mode. It already
  // teaches the camera gestures, so the tiny cam-hint is suppressed on that same first open.
  const [tutorial, setTutorial] = useState(() => !getSettings().factoryTutorialSeen);
  useEffect(() => {
    if (!use3d || tutorial) return; // the tutorial covers the gesture on the very first open
    try { if (localStorage.getItem("silicon.factory.camhint") === "1") return; } catch { /* ignore */ }
    setCamHint(true);
    try { localStorage.setItem("silicon.factory.camhint", "1"); } catch { /* ignore */ }
    const t = setTimeout(() => setCamHint(false), 4200);
    return () => clearTimeout(t);
  }, [use3d, tutorial]);
  const { buyFloorMachine, buyFloorBelt, buyFactoryProp, clearFloorCell, upgradeFloorMachine } = d.game;
  const lineOk = lineComplete(d.floor);

  // Machine placement is a MOVABLE GHOST, not a blind tap: arming a machine tool drops a translucent
  // machine on the floor; tapping cells nudges it, and Place (buy) / Cancel commits from the strip.
  // No more "Doesn't fit there" the instant you tap — you SEE where it lands before paying.
  const pendingKind = buildTool != null && buildTool in MACHINE_DEFS ? (buildTool as MachineKind) : null;
  const [pendingCell, setPendingCell] = useState<{ c: number; r: number } | null>(null);
  const placeableAt = (kind: MachineKind, c: number, r: number, floor = state.factoryFloor): boolean => {
    const w = floorWidth(state.factoryExpansion);
    if (!canPlaceMachine(floor, kind, c, r, w)) return false;
    const props = propCellSet(state.factoryProps);
    return !machineCells({ kind, c, r }).some((cell) => props.has(cell));
  };
  const findPlacementCell = (kind: MachineKind, floor = state.factoryFloor): { c: number; r: number } => {
    const w = floorWidth(state.factoryExpansion);
    const def = MACHINE_DEFS[kind];
    const cc = Math.round((w - def.w) / 2), cr = Math.round((FLOOR.h - def.d) / 2);
    let best: { c: number; r: number } | null = null, bestD = Infinity;
    for (let r = 0; r <= FLOOR.h - def.d; r++) for (let c = 0; c <= w - def.w; c++) {
      if (!placeableAt(kind, c, r, floor)) continue;
      const dd = Math.abs(c - cc) + Math.abs(r - cr);
      if (dd < bestD) { bestD = dd; best = { c, r }; }
    }
    return best ?? { c: 0, r: 0 };
  };
  // Arm a machine → seed the ghost at the nearest-to-centre free cell; disarm → clear it.
  useEffect(() => {
    setPendingCell(pendingKind ? findPlacementCell(pendingKind) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildTool]);
  const pendingValid = pendingKind != null && pendingCell != null && placeableAt(pendingKind, pendingCell.c, pendingCell.r);

  const onTapCell = (c: number, r: number) => {
    if (!buildTool) return;
    if (pendingKind) { setPendingCell({ c, r }); haptic.light(); return; } // machine: tap moves the ghost, Place commits
    if (buildTool === "erase") {
      clearFloorCell(c, r);
      haptic.light();
      setFlash((f) => ({ c, r, ok: true, n: (f?.n ?? 0) + 1 }));
      return;
    }
    if (buildTool === "upgrade") {
      const res = upgradeFloorMachine(c, r);
      setFlash((f) => ({ c, r, ok: res.ok, n: (f?.n ?? 0) + 1 }));
      if (res.ok) { haptic.success(); sfx("build"); showToast("Machine tuned up — the line builds faster", { tone: "positive" }); }
      else { haptic.warning(); showToast(res.reason ?? "Nothing to upgrade here", { tone: "negative" }); }
      return;
    }
    const isProp = buildTool in PROP_DEFS;
    const res = isProp
      ? buyFactoryProp(buildTool as PropKind, c, r)
      : buildTool === "belt" ? buyFloorBelt(c, r, beltDir) : buyFloorMachine(buildTool as MachineKind, c, r);
    setFlash((f) => ({ c, r, ok: res.ok, n: (f?.n ?? 0) + 1 }));
    if (res.ok) { haptic.light(); if (buildTool !== "belt") { sfx("build"); haptic.success(); } }
    else { haptic.warning(); showToast(res.reason ?? "Can't build there", { tone: "negative" }); }
  };

  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The tutorial owns Escape while it's open (it closes itself); don't also peel the mode.
      if (tutorial) return;
      // A top-level app overlay (offline recap / era / IPO) shown OVER the factory owns Escape too —
      // otherwise one press dismisses the overlay AND slams the whole factory shut underneath it.
      if (appOverlayOpen()) return;
      // Escape peels back one layer at a time: an open sheet, then the build tool, then the mode.
      if (sheet != null) setSheet(null);
      else if (buildTool != null) setBuildTool(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, buildTool, sheet, tutorial]);
  // Lock background scroll for as long as the mode is mounted — a SEPARATE, mount-once effect so
  // the frequently-re-running keydown effect above can't churn it, and ref-counted so an inner
  // Sheet's own lock can't clobber ours and leak a permanent lock (stuck-scroll bug).
  useEffect(() => lockScroll(), []);

  const flow = sub(d.revenueWk, d.expensesWk);
  const flowD = toDollars(flow);

  // Robotics (Assembly) — the Upgrades sheet's headline line.
  const roboticsTier = d.robotTier;
  const roboticsCost = nextUpgradeCost("assembly", roboticsTier);
  const roboticsLock = upgradeLockedBy("assembly", roboticsTier + 1, state.completedProjects);

  return createPortal(
    <div ref={ref} tabIndex={-1} className="fmode" role="dialog" aria-modal="true" aria-label="Factory mode">
      <div className="fmode__stage">
        {use3d ? (
          <Suspense fallback={<FloorMinimap floor={d.floor} lineOk={lineOk} running={d.active} floorW={floorWidth(state.factoryExpansion)} lockedBayW={state.factoryExpansion < MAX_EXPANSION ? EXPAND_STEP : 0} />}>
            <Factory3D
              active={d.active}
              activeKind={d.activeKind}
              robotTier={d.robotTier}
              readyCount={d.readyCount}
              selling={d.selling}
              overtime={d.overtime}
              floor={d.floor}
              product={d.lead?.product ?? null}
              lineOk={lineOk}
              buildMode={buildTool != null}
              pending={pendingKind && pendingCell ? { kind: pendingKind, c: pendingCell.c, r: pendingCell.r, valid: pendingValid } : null}
              resetView={resetView}
              wallColor={(FACTORY_WALLS[state.factoryDecor.wall] ?? FACTORY_WALLS[0]).hex}
              floorColor={(FACTORY_FLOORS[state.factoryDecor.floor] ?? FACTORY_FLOORS[0]).hex}
              props={state.factoryProps}
              floorW={floorWidth(state.factoryExpansion)}
              era={state.era}
              lockedBay={(() => {
                const cost = nextExpansionCost(state.factoryExpansion);
                if (cost == null) return null;
                return expandArm
                  ? { cols: EXPAND_STEP, label: `Tap again \u00b7 ${format(cost)}`, armed: true }
                  : { cols: EXPAND_STEP, label: `Expand \u00b7 ${format(cost)}` };
              })()}
              onTapLockedBay={() => {
                const cost = nextExpansionCost(state.factoryExpansion);
                if (cost == null) return;
                if (state.cash < cost) {
                  haptic.warning();
                  showToast(`Need ${format(sub(cost, state.cash))} more to expand the floor.`, { tone: "negative" });
                  return;
                }
                if (!expandArm) { haptic.light(); setExpandArm(true); return; }
                setExpandArm(false);
                const res = d.game.buyFloorExpansion();
                if (res.ok) { haptic.success(); sfx("build"); emitCelebrate(); setResetView((v) => v + 1); showToast("New bay unlocked \u2014 the floor grows east", { tone: "positive" }); }
                else { haptic.warning(); showToast(res.reason ?? "Can't expand", { tone: "negative" }); }
              }}
              onTapCell={onTapCell}
              paintBelts={buildTool === "belt"}
              onPaintBelts={(cells) => {
                const res = d.game.paintBeltRun(cells, beltDir);
                if (res.ok) { haptic.light(); sfx("build"); }
                else { haptic.warning(); showToast(res.reason ?? "Can't lay a belt there", { tone: "negative" }); }
              }}
              onCarryChange={(carrying) => { if (carrying) haptic.light(); }}
              onMovePiece={(piece, c, r) => {
                const res = piece.type === "machine" ? d.game.moveFloorMachine(piece.id, c, r) : d.game.moveFactoryProp(piece.id, c, r);
                if (res.ok) { haptic.success(); sfx("build"); }
                else { haptic.warning(); showToast(res.reason ?? "Doesn't fit there", { tone: "negative" }); }
                return res;
              }}
              flash={flash}
              onContextLost={() => setGlLost(true)}
            />
          </Suspense>
        ) : (
          <FloorMinimap floor={d.floor} lineOk={lineOk} running={d.active} floorW={floorWidth(state.factoryExpansion)} lockedBayW={state.factoryExpansion < MAX_EXPANSION ? EXPAND_STEP : 0} />
        )}
      </div>

      {/* top bar */}
      <div className="fmode__top">
        <span className="fmode__lvl" title={`Industry rank #${industryRank(state)}`}>E{state.era}</span>
        <span className="fmode__cash">
          <span className="fmode__cash-val tnum">{format(state.cash)}</span>
          <span className={`fmode__cash-flow tnum${flowD < 0 ? " fmode__cash-flow--neg" : ""}`}>
            {flowD >= 0 ? "+" : ""}{format(flow)}/wk
          </span>
        </span>
        {use3d && (
          <button className="fmode__icons" aria-label="Recenter view" title="Recenter view" onClick={() => { haptic.light(); setResetView((v) => v + 1); }}>
            <Locate size={18} />
          </button>
        )}
        <button className="fmode__icons" aria-label="How the factory works" title="How the factory works" onClick={() => { haptic.light(); setTutorial(true); }}>
          <HelpCircle size={18} />
        </button>
        <button className="fmode__close" aria-label="Close factory" onClick={() => { haptic.light(); onClose(); }}><X size={20} /></button>
      </div>
      {camHint && (
        <div className="fmode__camhint" role="status">
          <Move3d size={15} aria-hidden /> Drag to look around · pinch to zoom
        </div>
      )}

      {/* left panels */}
      <div className="fmode__left">
        {!lineOk && (
          <div className="fmode__panel fmode__stopped">
            <span className="fmode__stopped-title"><Wrench size={14} aria-hidden /> Line offline</span>
            <p className="fmode__empty">Connect the Intake to the Packer — build the line yourself, or tap Auto to align every machine and route the belts for you. A wired line builds every run faster.</p>
            <button className="fmode__stopped-fix" onClick={() => { haptic.light(); if (!use3d) { showToast("Building needs the 3D factory view — turn it on in Settings.", { tone: "neutral" }); return; } setBuildCat("machine"); setBuildTool("belt"); }}>Fix in Build</button>
          </div>
        )}
        <div className="fmode__panel">
          <button className="fmode__panel-head" aria-expanded={orderOpen} onClick={() => { haptic.light(); setOrderOpen(!orderOpen); }}>
            <span className="fmode__panel-title">Current order</span>
            <ChevronDown size={14} className={`fmode__panel-caret${orderOpen ? " fmode__panel-caret--open" : ""}`} aria-hidden />
          </button>
          {!orderOpen ? null : d.lead ? (
            <div className="fmode__order">
              <span className="fmode__order-thumb"><DeviceRenderer product={d.lead.product} size={42} /></span>
              <div className="fmode__order-info">
                <span className="fmode__order-name">{d.lead.product.name}</span>
                <span className="fmode__order-units tnum">{(d.lead.plannedUnits ?? 0).toLocaleString()} units</span>
                <span className="fmode__order-track"><span className="fmode__order-fill" style={{ width: `${Math.round(d.progress * 100)}%` }} /></span>
                <span className="fmode__order-eta">{d.stage?.label} · {d.weeksLeft} wk left</span>
                <StageTrail category={d.lead.product.category} frac={d.progress} />
                {d.util != null && (
                  <span className={`fmode__cap-line${d.overtime ? " fmode__cap-line--hot" : ""}`}>
                    <span className="fmode__cap-bar"><span className="fmode__cap-fill" style={{ width: `${Math.min(100, Math.round(d.util * 100))}%` }} /></span>
                    {d.overtime ? "Overtime" : "On schedule"}
                  </span>
                )}
                {(d.linePct > 0 || !lineOk || d.missing.length > 0) && (
                  <span className={`fmode__lineboon${d.linePct > 0 ? " fmode__lineboon--good" : " fmode__lineboon--bad"}`}>
                    <Zap size={12} aria-hidden />
                    {!lineOk
                      ? "Wire Intake → Packer for a build-speed bonus"
                      : d.missing.length
                        ? `Line +${d.linePct}% · add ${MACHINE_DEFS[d.missing[0]].name}${d.missing.length > 1 ? ` +${d.missing.length - 1}` : ""} for more`
                        : `Line builds ${d.linePct}% faster`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="fmode__empty">No active order. Plan a production run in the Design Lab.</p>
          )}
        </div>

        {/* Side order — a client commission on offer, or the one running on the line. */}
        {state.pendingSideOrder && !state.activeSideOrder && (() => {
          const offer = state.pendingSideOrder;
          const missingKinds = offer.requiredKinds.filter((k) => !state.factoryFloor.machines.some((m) => m.kind === k));
          const wired = lineComplete(state.factoryFloor);
          const can = wired && missingKinds.length === 0;
          const expiresIn = Math.max(0, offer.expiresWeek - state.week);
          const payout = sideOrderPayout(offer);
          return (
            <div className="fmode__panel fmode__sideorder">
              <span className="fmode__sideorder-head"><Truck size={14} aria-hidden /> Client order · expires in {expiresIn} wk</span>
              <p className="fmode__sideorder-body">
                <b>{offer.clientName}</b> wants {offer.blurb}: {offer.units.toLocaleString()} units in {offer.weeksNeeded} wk — <b>{format(payout)}</b> on delivery. Your own builds run +1 wk meanwhile.
              </p>
              {!can && (
                <p className="fmode__sideorder-warn">
                  {!wired ? "Needs a wired Intake → Packer line." : `Needs a ${MACHINE_DEFS[missingKinds[0]]?.name ?? "machine"} on the floor.`}
                </p>
              )}
              <div className="fmode__sideorder-actions">
                <button className="fmode__sideorder-go" disabled={!can} onClick={() => d.game.acceptSideOrder()}>
                  Accept order
                </button>
                <button className="fmode__sideorder-x" onClick={() => d.game.declineSideOrder()}>Pass</button>
              </div>
            </div>
          );
        })()}
        {state.activeSideOrder && (() => {
          const so = state.activeSideOrder;
          const weeksLeft = Math.max(0, so.startedWeek + so.weeksNeeded - state.week);
          const frac = Math.max(0, Math.min(1, (state.week - so.startedWeek) / Math.max(1, so.weeksNeeded)));
          const payout = sideOrderPayout(so);
          const feePct = Math.round(SIDE_ORDER_CANCEL_PCT * 100);
          return (
            <div className="fmode__panel fmode__sideorder fmode__sideorder--live">
              <span className="fmode__sideorder-head"><Truck size={14} aria-hidden /> Running {so.clientName}'s order</span>
              <span className="fmode__sideorder-track"><span className="fmode__sideorder-fill" style={{ width: `${Math.round(frac * 100)}%` }} /></span>
              <p className="fmode__sideorder-body tnum">{weeksLeft} wk left · {format(payout)} on delivery</p>
              <button
                className="fmode__sideorder-x"
                onClick={() => {
                  if (!cancelArm) { haptic.light(); setCancelArm(true); return; }
                  setCancelArm(false);
                  haptic.warning();
                  d.game.cancelSideOrder();
                }}
              >
                {cancelArm ? `Confirm — forfeit ${feePct}%` : `Cancel · ${feePct}% fee`}
              </button>
            </div>
          );
        })()}
      </div>

      {/* right tool rail */}
      <div className="fmode__rail">
        <button
          className={`fmode__tool${buildTool != null ? " fmode__tool--on" : ""}`}
          onClick={() => {
            haptic.light();
            // Placement is wired to the 3D pad; the 2D fallback can't drop machines, so tell the
            // player instead of arming a tool that silently does nothing.
            if (!use3d) { showToast("Building needs the 3D factory view — turn it on in Settings.", { tone: "neutral" }); return; }
            if (buildTool != null) { setBuildTool(null); } else { setBuildCat("machine"); setBuildTool("belt"); }
          }}
        >
          <Hammer size={18} /><span>Build</span>
        </button>
        <button className="fmode__tool" onClick={() => { haptic.light(); setSheet("upgrades"); }}>
          <Bot size={18} /><span>Upgrades</span>
          {roboticsCost != null && !roboticsLock && state.cash >= roboticsCost && <span className="fmode__dot" aria-hidden />}
        </button>
        {onNavigate && (
          <button className="fmode__tool" onClick={() => { haptic.light(); onClose(); onNavigate("research"); }}>
            <FlaskConical size={18} /><span>Research</span>
          </button>
        )}
        <button className="fmode__tool" onClick={() => { haptic.light(); setSheet("decor"); }}>
          <Palette size={18} /><span>Style</span>
        </button>
        <button className="fmode__tool" onClick={() => { haptic.light(); setSheet("stats"); }}>
          <BarChart3 size={18} /><span>Stats</span>
        </button>
      </div>

      {/* bottom strip — swaps to the build toolbar while a tool is armed */}
      {buildTool != null && (
        <div className="fmode__build">
          <div className="fmode__build-head">
            {(() => {
              // A machine is armed → the head becomes its PLACE strip: green Place (buy at the ghost
              // cell) + red Cancel. Tapping the floor moves the ghost; the button reflects live validity.
              if (pendingKind && pendingCell) {
                const cost = MACHINE_DEFS[pendingKind].cost;
                const broke = state.cash < cost;
                return (
                  <>
                    <span className="fmode__autoquote-label">
                      <Hammer size={14} aria-hidden /> {MACHINE_DEFS[pendingKind].name} · tap the floor to move
                    </span>
                    <button
                      className="fmode__buy fmode__autoquote-go"
                      disabled={!pendingValid || broke}
                      onClick={() => {
                        const res = d.game.buyFloorMachine(pendingKind, pendingCell.c, pendingCell.r);
                        if (res.ok) {
                          haptic.success(); sfx("build");
                          showToast(`${MACHINE_DEFS[pendingKind].name} placed`, { tone: "positive" });
                          // state.factoryFloor won't reflect the machine we just placed until the next
                          // render — seed the next ghost against a merged copy so back-to-back placements
                          // don't land the ghost back on the cell we just filled.
                          const merged = { ...state.factoryFloor, machines: [...state.factoryFloor.machines, { id: "pending", kind: pendingKind, c: pendingCell.c, r: pendingCell.r }] };
                          setPendingCell(findPlacementCell(pendingKind, merged));
                        }
                        else { haptic.warning(); showToast(res.reason ?? "Can't place there", { tone: "negative" }); }
                      }}
                    >
                      {broke ? "Can't afford" : `Place · ${format(cost)}`}
                    </button>
                    <button className="fmode__autoquote-x" aria-label="Cancel placement" onClick={() => { haptic.light(); setBuildTool(null); }}><X size={16} /></button>
                  </>
                );
              }
              // Auto armed → the head becomes the QUOTE: route size + exact price, Confirm / Cancel.
              // The quote re-derives from live state every render, so it can never drift from the
              // price autoConnectLine will actually charge (same deterministic router).
              const quote = autoArmed ? autoConnectQuote(state) : null;
              if (autoArmed && quote) {
                const tooPricey = quote.cost > 0 && state.cash < quote.cost;
                return (
                  <>
                    <span className="fmode__autoquote-label">
                      <Waypoints size={14} aria-hidden /> Tidy the line · {quote.tiles} tiles
                    </span>
                    <button
                      className="fmode__buy fmode__autoquote-go"
                      disabled={tooPricey}
                      onClick={() => {
                        const res = d.game.autoConnectLine();
                        if (res.ok) { haptic.success(); sfx("build"); showToast("Line tidied — machines aligned, belts routed", { tone: "positive" }); }
                        else { haptic.warning(); showToast(res.reason ?? "Couldn't tidy the line", { tone: "negative" }); }
                        setAutoArmed(false);
                      }}
                    >
                      {quote.cost > 0 ? `Confirm · ${format(quote.cost)}` : quote.cost < 0 ? `Confirm · +${format((-quote.cost) as typeof quote.cost)} back` : "Confirm · free"}
                    </button>
                    <button className="fmode__autoquote-x" aria-label="Cancel auto route" onClick={() => { haptic.light(); setAutoArmed(false); }}><X size={16} /></button>
                  </>
                );
              }
              return (
                <>
                  <div className="fmode__build-seg" role="tablist" aria-label="Build category">
                    <button role="tab" aria-selected={buildCat === "machine"} className={`fmode__build-tab${buildCat === "machine" ? " fmode__build-tab--on" : ""}`} onClick={() => { haptic.light(); setBuildCat("machine"); setBuildTool("belt"); }}>Machines</button>
                    <button role="tab" aria-selected={buildCat === "decor"} className={`fmode__build-tab${buildCat === "decor" ? " fmode__build-tab--on" : ""}`} onClick={() => { haptic.light(); setBuildCat("decor"); setBuildTool("crates"); }}>Decor</button>
                  </div>
                  <span className="fmode__build-rule">{buildTool === "belt" ? "Drag to paint a belt run · tap for one · Auto routes it all." : buildCat === "machine" ? "Tap to place · hold any piece to move it. Erase refunds half." : "Tap to place · hold a prop to move it. Erase refunds half."}</span>
                  <button className="fmode__build-done" onClick={() => { haptic.light(); setBuildTool(null); }}>Done</button>
                </>
              );
            })()}
          </div>
          <div className="fmode__palette">
            {buildCat === "machine" ? (
              <>
                <button
                  className={`fmode__ptile${buildTool === "belt" ? " fmode__ptile--on" : ""}${state.cash < BELT_COST ? " fmode__ptile--broke" : ""}`}
                  onClick={() => { haptic.light(); setBuildTool("belt"); }}
                >
                  <span className="fmode__ptile-icon" style={{ transform: `rotate(${DIR_ROT[beltDir]}deg)` }}><ArrowUp size={20} /></span>
                  <span className="fmode__ptile-name">Belt</span>
                  <span className="fmode__ptile-cost">{format(BELT_COST)}</span>
                </button>
                <button
                  className="fmode__ptile fmode__ptile--util"
                  aria-label="Rotate belt direction"
                  onClick={() => { haptic.light(); setBeltDir(beltDir === "e" ? "s" : beltDir === "s" ? "w" : beltDir === "w" ? "n" : "e"); setBuildTool("belt"); }}
                >
                  <span className="fmode__ptile-icon"><RotateCw size={20} /></span>
                  <span className="fmode__ptile-name">Turn</span>
                </button>
                <button
                  className={`fmode__ptile fmode__ptile--util${autoArmed ? " fmode__ptile--on" : ""}`}
                  aria-label="Auto-connect the Intake to the Packer"
                  title="Tidy the whole line — align every machine into clean lanes and route the belts (shows the price first)"
                  onClick={() => {
                    haptic.light();
                    if (autoArmed) { setAutoArmed(false); return; }
                    if (!autoConnectQuote(state)) { haptic.warning(); showToast("Place an Intake and a Packer first — then Auto tidies the rest.", { tone: "negative" }); return; }
                    setAutoArmed(true);
                  }}
                >
                  <span className="fmode__ptile-icon"><Waypoints size={20} /></span>
                  <span className="fmode__ptile-name">Auto</span>
                </button>
                {(Object.keys(MACHINE_DEFS) as MachineKind[]).map((k) => {
                  const Icon = MACHINE_ICONS[k];
                  const broke = state.cash < MACHINE_DEFS[k].cost;
                  return (
                    <button
                      key={k}
                      className={`fmode__ptile${buildTool === k ? " fmode__ptile--on" : ""}${broke ? " fmode__ptile--broke" : ""}`}
                      title={MACHINE_DEFS[k].blurb}
                      onClick={() => { haptic.light(); setBuildTool(k); }}
                    >
                      <span className="fmode__ptile-icon"><Icon size={20} /></span>
                      <span className="fmode__ptile-name">{MACHINE_SHORT[k]}</span>
                      <span className="fmode__ptile-cost">{format(MACHINE_DEFS[k].cost)}</span>
                    </button>
                  );
                })}
              </>
            ) : (
              (Object.keys(PROP_DEFS) as PropKind[]).map((k) => {
                const Icon = PROP_ICONS[k];
                const broke = state.cash < PROP_DEFS[k].cost;
                return (
                  <button
                    key={k}
                    className={`fmode__ptile${buildTool === k ? " fmode__ptile--on" : ""}${broke ? " fmode__ptile--broke" : ""}`}
                    onClick={() => { haptic.light(); setBuildTool(k); }}
                  >
                    <span className="fmode__ptile-icon"><Icon size={20} /></span>
                    <span className="fmode__ptile-name">{PROP_DEFS[k].name}</span>
                    <span className="fmode__ptile-cost">{format(PROP_DEFS[k].cost)}</span>
                  </button>
                );
              })
            )}
            {buildCat === "machine" && (
              <button
                className={`fmode__ptile${buildTool === "upgrade" ? " fmode__ptile--on" : ""}`}
                onClick={() => { haptic.light(); setBuildTool("upgrade"); }}
                title="Tap a machine to tune it up a tier (faster builds)"
              >
                <span className="fmode__ptile-icon"><Wrench size={20} /></span>
                <span className="fmode__ptile-name">Upgrade</span>
              </button>
            )}
            <button
              className={`fmode__ptile fmode__ptile--erase${buildTool === "erase" ? " fmode__ptile--on" : ""}`}
              onClick={() => { haptic.light(); setBuildTool("erase"); }}
            >
              <span className="fmode__ptile-icon"><Eraser size={20} /></span>
              <span className="fmode__ptile-name">Erase</span>
            </button>
          </div>
        </div>
      )}
      {buildTool == null && (
      <div className="fmode__bottom">
        <BoostButton />
        <button
          className="fmode__side"
          title={`${d.readyCount} ready to launch`}
          onClick={() => { if (onNavigate) { haptic.light(); onClose(); onNavigate("hq"); } }}
        >
          <Truck size={16} aria-hidden />{d.readyCount > 0 && <span className="fmode__side-n tnum">{d.readyCount}</span>}
        </button>
        <button className="fmode__side" title="Machine shop" onClick={() => { haptic.light(); setSheet("shop"); }}>
          <ShoppingCart size={16} aria-hidden />
        </button>
      </div>
      )}

      {/* sheets */}
      <Sheet open={sheet === "upgrades"} onClose={() => setSheet(null)} label="Factory upgrades">
        <div className="fmode__sheet">
          <h3 className="fmode__sheet-title">Factory upgrades</h3>
          <div className="fmode__upline">
            <span className="fmode__upline-glyph" aria-hidden><Bot size={18} /></span>
            <div className="fmode__upline-info">
              <span className="fmode__upline-name">{upgradeLine("assembly").name} · Tier {roboticsTier}</span>
              <span className="fmode__upline-sub">Each tier builds faster and cheaper, and adds a robot to the floor.</span>
            </div>
            {roboticsCost == null ? (
              <span className="fmode__upline-max">Maxed</span>
            ) : roboticsLock ? (
              <span className="fmode__upline-lock"><Lock size={12} aria-hidden /> {projectById(roboticsLock)?.name ?? roboticsLock}</span>
            ) : (
              <button
                className="fmode__buy"
                disabled={state.cash < roboticsCost}
                onClick={() => { buyUpgrade("assembly"); haptic.success(); sfx("upgrade"); }}
              >
                {format(roboticsCost)}
              </button>
            )}
          </div>
          <p className="fmode__sheet-note">Design Suite, Test Lab, Marketing and the rest live on the Company tab.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === "stats"} onClose={() => setSheet(null)} label="Factory stats">
        <div className="fmode__sheet">
          <h3 className="fmode__sheet-title">Factory stats</h3>
          <div className="fmode__stat"><span>Line</span><span>{d.fac.name} · {d.fac.kind === "owned" ? "owned" : "contract"}</span></div>
          <div className="fmode__stat"><span>Runs in production</span><span className="tnum">{state.building.length}</span></div>
          <div className="fmode__stat"><span>Ready to launch</span><span className="tnum">{d.readyCount}</span></div>
          <div className="fmode__stat"><span>Units/wk</span><span className="tnum">{d.unitsWk.toLocaleString()}</span></div>
          <div className="fmode__stat"><span>Revenue/wk</span><span className="tnum">{format(d.revenueWk)}</span></div>
          <div className="fmode__stat"><span>Expenses/wk</span><span className="tnum">{format(d.expensesWk)}</span></div>
          <div className="fmode__stat"><span>Profit/wk</span><span className={`tnum ${toDollars(d.profitWk) >= 0 ? "fmode__pos" : "fmode__neg"}`}>{format(d.profitWk)}</span></div>
          {d.util != null && <div className="fmode__stat"><span>Capacity used</span><span className="tnum">{Math.round(d.util * 100)}%</span></div>}
          <div className="fmode__stat">
            <span>Line build speed</span>
            <span className={`tnum ${d.linePct > 0 ? "fmode__pos" : ""}`}>
              {d.linePct > 0 ? `+${d.linePct}%` : "baseline"}
            </span>
          </div>
          {d.missing.length > 0 ? (
            <p className="fmode__sheet-note">This order wants a {d.missing.map((k) => MACHINE_DEFS[k].name).join(", ")} on the floor — add {d.missing.length > 1 ? "them" : "one"} in Build to speed it up. Arms and machine upgrades build faster too.</p>
          ) : (
            <p className="fmode__sheet-note">Wire Intake → Packer for a build-speed bonus; cover the product's recipe and add Arms or Upgrades to deepen it.</p>
          )}
          <div className="fmode__matsline" aria-label="Parts committed to production">
            {(Object.keys(MATERIAL_ICONS) as ComponentKind[]).map((kind) => {
              const Icon = MATERIAL_ICONS[kind];
              const n = d.materials.get(kind) ?? 0;
              return (
                <span key={kind} className={`fmode__matschip${n === 0 ? " fmode__matschip--zero" : ""}`} title={kind}>
                  <Icon size={13} aria-hidden /><span className="tnum">{fmtCount(n)}</span>
                </span>
              );
            })}
          </div>
        </div>
      </Sheet>

      <Sheet open={sheet === "shop"} onClose={() => setSheet(null)} label="Machine shop">
        <div className="fmode__sheet">
          <h3 className="fmode__sheet-title">Machine shop</h3>
          <p className="fmode__sheet-note">Production lines you can contract or buy outright — pick per product in the Design Lab's Advanced sourcing.</p>
          {Object.values(FACTORIES).filter((f) => f.era <= state.era).map((f) => (
            <div key={f.id} className="fmode__upline">
              <span className="fmode__upline-glyph" aria-hidden><Hammer size={16} /></span>
              <div className="fmode__upline-info">
                <span className="fmode__upline-name">{f.name}</span>
                <span className="fmode__upline-sub">{f.blurb}</span>
              </div>
              <span className="fmode__upline-max">
                {f.kind === "owned" ? (state.ownedFactories.includes(f.id) ? "Owned" : format(f.acquireCost)) : "Contract"}
              </span>
            </div>
          ))}
          <p className="fmode__sheet-note">Want to place machines yourself? Use the Build tool on the rail to grow your own floor.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === "decor"} onClose={() => { setSheet(null); setConfirmLayout(null); }} label="Style the building">
        <div className="fmode__sheet">
          <h3 className="fmode__sheet-title">Style the building</h3>
          <span className="fmode__decor-label">Wall paint</span>
          <div className="fmode__swatches">
            {FACTORY_WALLS.map((w, i) => (
              <button
                key={w.hex}
                className={`fmode__swatch${state.factoryDecor.wall === i ? " fmode__swatch--on" : ""}`}
                style={{ background: w.hex }}
                aria-label={`Wall: ${w.name}`}
                aria-pressed={state.factoryDecor.wall === i}
                title={w.name}
                onClick={() => { haptic.light(); d.game.setFactoryDecor({ wall: i }); }}
              />
            ))}
          </div>
          <span className="fmode__decor-label">Floor finish</span>
          <div className="fmode__swatches">
            {FACTORY_FLOORS.map((f, i) => (
              <button
                key={f.hex}
                className={`fmode__swatch${state.factoryDecor.floor === i ? " fmode__swatch--on" : ""}`}
                style={{ background: f.hex }}
                aria-label={`Floor: ${f.name}`}
                aria-pressed={state.factoryDecor.floor === i}
                title={f.name}
                onClick={() => { haptic.light(); d.game.setFactoryDecor({ floor: i }); }}
              />
            ))}
          </div>
          <p className="fmode__sheet-note">Repaint anytime — free, and it saves with your factory.</p>
          <span className="fmode__decor-label">Floor size</span>
          <div className="fmode__upline">
            <span className="fmode__upline-glyph" aria-hidden><Maximize2 size={16} /></span>
            <div className="fmode__upline-info">
              <span className="fmode__upline-name">Expand the floor</span>
              <span className="fmode__upline-sub">Adds a bay of build space to the east.</span>
            </div>
            {(() => {
              const cost = nextExpansionCost(state.factoryExpansion);
              if (cost == null) return <span className="fmode__upline-max">Max size</span>;
              return (
                <button className="fmode__buy" disabled={state.cash < cost} onClick={() => {
                  const res = d.game.buyFloorExpansion();
                  if (res.ok) { haptic.success(); sfx("build"); emitCelebrate(); setResetView((v) => v + 1); showToast("New bay unlocked — the floor grows east", { tone: "positive" }); }
                  else { haptic.warning(); showToast(res.reason ?? "Can't expand", { tone: "negative" }); }
                }}>{format(cost)}</button>
              );
            })()}
          </div>

          <span className="fmode__decor-label">Saved layouts</span>
          <div className="fmode__layouts">
            {state.factoryLayouts.length === 0 && (
              <p className="fmode__sheet-note">Snapshot this floor to save its design, then switch between layouts anytime. Applying one charges (or refunds) only the difference.</p>
            )}
            {state.factoryLayouts.map((l) => {
              const cost = factoryLayoutCost(state, l);
              const costLabel = cost === 0 ? "Apply" : cost > 0 ? format(cost) : `+${format((-cost) as typeof cost)}`;
              const tooPricey = cost > 0 && state.cash < cost;
              const confirming = confirmLayout === l.id;
              // Applying replaces the WHOLE floor and can cost a fortune — so the first tap arms it and
              // shows the exact +added / −removed diff, and only a second tap commits.
              const diff = confirming ? layoutDiff(state.factoryFloor, state.factoryProps, l.floor, l.props) : null;
              const confirmLabel = cost > 0 ? `Confirm · ${format(cost)}` : cost < 0 ? `Confirm · +${format((-cost) as typeof cost)}` : "Confirm";
              return (
                <div className={`fmode__layout${confirming ? " fmode__layout--armed" : ""}`} key={l.id}>
                  <div className="fmode__layout-info">
                    <span className="fmode__layout-name">{l.name}</span>
                    {confirming && diff ? (
                      <span className="fmode__layout-sub">
                        {diff.added === 0 && diff.removed === 0
                          ? "No changes to the floor"
                          : [diff.added ? `+${diff.added} added` : null, diff.removed ? `−${diff.removed} removed` : null].filter(Boolean).join(" · ")}
                      </span>
                    ) : (
                      <span className="fmode__layout-sub">{l.floor.machines.length} machines · saved wk {l.savedWeek}</span>
                    )}
                  </div>
                  {confirming ? (
                    <>
                      <button
                        className="fmode__layout-apply"
                        disabled={tooPricey}
                        onClick={() => {
                          const res = d.game.applyFactoryLayout(l.id);
                          if (res.ok) { haptic.success(); sfx("build"); showToast(`Floor set to “${l.name}”`, { tone: "positive" }); }
                          else { haptic.warning(); showToast(res.reason ?? "Can't apply that layout", { tone: "negative" }); }
                          setConfirmLayout(null);
                        }}
                      >{confirmLabel}</button>
                      <button className="fmode__layout-del" aria-label="Cancel" onClick={() => { haptic.light(); setConfirmLayout(null); }}><X size={15} /></button>
                    </>
                  ) : (
                    <>
                      <button
                        className={`fmode__layout-apply${cost > 0 ? "" : " fmode__layout-apply--free"}`}
                        disabled={tooPricey}
                        onClick={() => { haptic.light(); setConfirmLayout(l.id); }}
                      >{cost <= 0 ? <Check size={13} /> : null}{costLabel}</button>
                      <button className="fmode__layout-del" aria-label={`Delete ${l.name}`} onClick={() => { haptic.light(); if (confirmLayout) setConfirmLayout(null); d.game.deleteFactoryLayout(l.id); }}><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="fmode__layout-save">
            <input
              className="fmode__layout-input"
              value={layoutName}
              maxLength={24}
              placeholder="Name this layout"
              aria-label="Layout name"
              onChange={(e) => setLayoutName(e.target.value)}
            />
            <button
              className="fmode__layout-savebtn"
              disabled={state.factoryLayouts.length >= MAX_LAYOUTS}
              onClick={() => {
                const res = d.game.saveFactoryLayout(layoutName);
                if (res.ok) { haptic.success(); sfx("confirm"); setLayoutName(""); showToast("Layout saved", { tone: "positive" }); }
                else { haptic.warning(); showToast(res.reason ?? "Can't save", { tone: "negative" }); }
              }}
            ><Bookmark size={14} /> Save current</button>
          </div>
          {state.factoryLayouts.length >= MAX_LAYOUTS && (
            <p className="fmode__sheet-note">Layout slots full ({MAX_LAYOUTS}). Delete one to save another.</p>
          )}
        </div>
      </Sheet>

      <FactoryTutorial open={tutorial} onClose={() => { setTutorial(false); setSettings({ factoryTutorialSeen: true }); }} />
    </div>,
    document.body,
  );
}

/** BOOST — the reference's paid time boost, translated honestly: rushBuild completes one week
 *  of the lead run for an overtime premium. Disabled when idle or unaffordable. */
function BoostButton() {
  const d = useFactoryData();
  const { rushBuild } = d.game;
  if (!d.lead || d.weeksLeft <= 0) {
    return <button className="fmode__boost" disabled><Zap size={16} aria-hidden /> BOOST</button>;
  }
  const id = d.lead.product.id;
  return (
    <button
      className="fmode__boost"
      onClick={() => {
        const res = rushBuild(id);
        if (res.ok) { haptic.success(); sfx("build"); showToast("Line rushed, one week saved", { tone: "positive" }); }
        else { haptic.warning(); showToast(res.reason ?? "Can't rush right now", { tone: "negative" }); }
      }}
    >
      <Zap size={16} aria-hidden /> BOOST · 1 wk
    </button>
  );
}

/* ------------------------------- compact card ------------------------------ */

/** The Office tab's Factory world: a live minimap that opens the fullscreen mode. */
export function FactoryCard({ onNavigate }: { onNavigate?: (t: Tab) => void }) {
  const d = useFactoryData();
  const { state } = d;
  const [open, setOpen] = useState(false);
  const settings = useSettings();
  const [glLost, setGlLost] = useState(false);
  const use3d = settings.garage3d && webglSupported() && !prefersReducedMotion() && !glLost;
  const cardLineOk = lineComplete(d.floor);
  // The card shows the REAL factory — the live 3D line, your paint job, the locked bay — not an
  // abstract map. Look-don't-touch (preview mode): taps open fullscreen, drags scroll the page.
  const mini = (
    <FloorMinimap floor={d.floor} lineOk={cardLineOk} running={d.active} floorW={floorWidth(state.factoryExpansion)} lockedBayW={state.factoryExpansion < MAX_EXPANSION ? EXPAND_STEP : 0} />
  );
  return (
    <div className="fcard">
      <button className="fcard__tap" onClick={() => { haptic.light(); setOpen(true); }} aria-label="Open factory mode">
        {use3d ? (
          <span className="fcard__scene" aria-hidden>
            <Suspense fallback={mini}>
              <Factory3D
                preview
                active={d.active}
                activeKind={d.activeKind}
                robotTier={d.robotTier}
                readyCount={d.readyCount}
                selling={d.selling}
                overtime={d.overtime}
                floor={d.floor}
                product={d.lead?.product ?? null}
                lineOk={cardLineOk}
                wallColor={(FACTORY_WALLS[state.factoryDecor.wall] ?? FACTORY_WALLS[0]).hex}
                floorColor={(FACTORY_FLOORS[state.factoryDecor.floor] ?? FACTORY_FLOORS[0]).hex}
                props={state.factoryProps}
                floorW={floorWidth(state.factoryExpansion)}
                era={state.era}
                lockedBay={(() => {
                  const cost = nextExpansionCost(state.factoryExpansion);
                  return cost == null ? null : { cols: EXPAND_STEP, label: `Expand · ${format(cost)}` };
                })()}
                onContextLost={() => setGlLost(true)}
              />
            </Suspense>
          </span>
        ) : (
          mini
        )}
        <span className="fcard__expand" aria-hidden><Maximize2 size={16} /></span>
      </button>
      <div className="fcard__chips">
        <span className="fcard__chip">{d.fac.name} · {d.fac.kind === "owned" ? "owned" : "contract"}</span>
        <span className="fcard__chip">
          {d.active
            ? `${d.state.building.length} run${d.state.building.length > 1 ? "s" : ""} · ${d.stage?.label ?? ""} · ${d.weeksLeft} wk left`
            : "Lines idle"}
        </span>
        {d.readyCount > 0 && <span className="fcard__chip fcard__chip--ready">{d.readyCount} ready</span>}
      </div>
      {open && <FactoryMode onClose={() => setOpen(false)} onNavigate={onNavigate} />}
    </div>
  );
}
