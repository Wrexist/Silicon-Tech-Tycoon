// Factory Mode F1 (FACTORY_MODE_PLAN.md) — the top-down tile factory from the reference
// guide: a machine-and-conveyor map with Current Order + Factory Stats panels, a right tool
// rail (Build/Upgrades/Research/Stats), a raw-materials tray, BOOST (the real rushBuild
// lever), truck and Shop along the bottom. Fully data-driven off the live sim; the map
// itself is an authored starter layout until Build mode lands in F2.
// Parametric SVG only (zero image assets); every animation sim-gated + reduced-motion safe.
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp, BarChart3, BatteryCharging, Bot, Boxes, Camera, ChevronDown, CodeXml, Cpu, Drill, Eraser,
  FlaskConical, Hammer, HelpCircle, Layers3, Locate, Lock, Maximize2, Monitor, MonitorSmartphone, Move3d,
  Container, Library, PackageCheck, Palette, RotateCw, ScanLine, ShoppingCart, Sprout, Stamp,
  TrafficCone, TriangleAlert, Truck, Wrench, X, Zap, type LucideIcon,
} from "lucide-react";
import { useGame } from "../state/useGame.tsx";
import { burn, industryRank, nextWeekRevenue, nextExpansionCost } from "../state/gameState.ts";
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
import { webglSupported, prefersReducedMotion } from "../garage3d/support.ts";
import { MACHINE_DEFS, BELT_COST, beltChain, floorWidth, lineComplete, lineSpeedMult, type BeltDir, type FactoryFloor as GameFloor, type MachineKind } from "../engine/factoryFloor.ts";
import { PROP_DEFS, type PropKind } from "../engine/factoryProps.ts";
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
  const active = state.building.length > 0;
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
  const lineSpeed = lineSpeedMult(state.factoryFloor); // <1 faster, 1 neutral, >1 slower (broken)
  const linePct = Math.round((1 - lineSpeed) * 100);   // + = faster, − = slower

  return {
    game, state, lead, active, progress, stage, activeKind, weeksLeft, readyCount, selling,
    fac, util, overtime, robotTier, unitsWk, revenueWk, expensesWk, profitWk, materials,
    floor: state.factoryFloor, lineSpeed, linePct,
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

export function FloorMinimap({ floor, lineOk, running }: { floor: GameFloor; lineOk: boolean; running: boolean }) {
  const K = 20; // px per cell in the 320×200 viewBox
  const chain = new Set(beltChain(floor.belts).map((b) => `${b.c},${b.r}`));
  return (
    <svg className={`fmini${running ? " fmini--run" : ""}`} viewBox="0 0 320 200" role="img"
      aria-label={lineOk ? "Factory layout, line connected" : "Factory layout, line incomplete"}>
      <rect x={0} y={0} width={320} height={200} rx={10} className="fmini__pad" />
      {Array.from({ length: 15 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * K} y1={0} x2={(i + 1) * K} y2={200} className="fmini__grid" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={(i + 1) * K} x2={320} y2={(i + 1) * K} className="fmini__grid" />
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
  const [buildTool, setBuildTool] = useState<null | MachineKind | PropKind | "belt" | "erase">(null);
  const [buildCat, setBuildCat] = useState<"machine" | "decor">("machine");
  const [beltDir, setBeltDir] = useState<BeltDir>("e");
  const [flash, setFlash] = useState<{ c: number; r: number; ok: boolean; n: number } | null>(null);
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
  const { buyFloorMachine, buyFloorBelt, buyFactoryProp, clearFloorCell } = d.game;
  const lineOk = lineComplete(d.floor);
  const onTapCell = (c: number, r: number) => {
    if (!buildTool) return;
    if (buildTool === "erase") {
      clearFloorCell(c, r);
      haptic.light();
      setFlash((f) => ({ c, r, ok: true, n: (f?.n ?? 0) + 1 }));
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
      // Escape peels back one layer at a time: an open sheet, then the build tool, then the mode.
      if (sheet != null) setSheet(null);
      else if (buildTool != null) setBuildTool(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, buildTool, sheet, tutorial]);

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
          <Suspense fallback={<FloorMinimap floor={d.floor} lineOk={lineOk} running={d.active} />}>
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
              resetView={resetView}
              wallColor={(FACTORY_WALLS[state.factoryDecor.wall] ?? FACTORY_WALLS[0]).hex}
              floorColor={(FACTORY_FLOORS[state.factoryDecor.floor] ?? FACTORY_FLOORS[0]).hex}
              props={state.factoryProps}
              floorW={floorWidth(state.factoryExpansion)}
              era={state.era}
              onTapCell={onTapCell}
              flash={flash}
              onContextLost={() => setGlLost(true)}
            />
          </Suspense>
        ) : (
          <FloorMinimap floor={d.floor} lineOk={lineOk} running={d.active} />
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
            <span className="fmode__stopped-title"><Wrench size={14} aria-hidden /> Line paused</span>
            <p className="fmode__empty">The belts don't reach from the Intake to the Packer yet.</p>
            <button className="fmode__stopped-fix" onClick={() => { haptic.light(); setBuildTool("belt"); }}>Fix in Build</button>
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
                {d.linePct !== 0 && (
                  <span className={`fmode__lineboon${d.linePct > 0 ? " fmode__lineboon--good" : " fmode__lineboon--bad"}`}>
                    <Zap size={12} aria-hidden />
                    {d.linePct > 0 ? `Line builds ${d.linePct}% faster` : `Line broken · ${-d.linePct}% slower`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="fmode__empty">No active order. Plan a production run in the Design Lab.</p>
          )}
        </div>
      </div>

      {/* right tool rail */}
      <div className="fmode__rail">
        <button
          className={`fmode__tool${buildTool != null ? " fmode__tool--on" : ""}`}
          onClick={() => { haptic.light(); if (buildTool != null) { setBuildTool(null); } else { setBuildCat("machine"); setBuildTool("belt"); } }}
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
            <div className="fmode__build-seg" role="tablist" aria-label="Build category">
              <button role="tab" aria-selected={buildCat === "machine"} className={`fmode__build-tab${buildCat === "machine" ? " fmode__build-tab--on" : ""}`} onClick={() => { haptic.light(); setBuildCat("machine"); setBuildTool("belt"); }}>Machines</button>
              <button role="tab" aria-selected={buildCat === "decor"} className={`fmode__build-tab${buildCat === "decor" ? " fmode__build-tab--on" : ""}`} onClick={() => { haptic.light(); setBuildCat("decor"); setBuildTool("crates"); }}>Decor</button>
            </div>
            <span className="fmode__build-rule">{buildCat === "machine" ? "Connect the Intake to the Packer. Erase refunds half." : "Dress the floor with props. Erase refunds half."}</span>
            <button className="fmode__build-done" onClick={() => { haptic.light(); setBuildTool(null); }}>Done</button>
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
      <Sheet open={sheet === "upgrades"} onClose={() => setSheet(null)}>
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

      <Sheet open={sheet === "stats"} onClose={() => setSheet(null)}>
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
            <span className={`tnum ${d.linePct > 0 ? "fmode__pos" : d.linePct < 0 ? "fmode__neg" : ""}`}>
              {d.linePct > 0 ? `+${d.linePct}%` : d.linePct < 0 ? `${d.linePct}%` : "baseline"}
            </span>
          </div>
          <p className="fmode__sheet-note">Keep the line connected and add assembly Arms in Build to build faster.</p>
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

      <Sheet open={sheet === "shop"} onClose={() => setSheet(null)}>
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
          <p className="fmode__sheet-note">Placeable machines arrive with Build mode.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === "decor"} onClose={() => setSheet(null)}>
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
                  if (res.ok) { haptic.success(); sfx("build"); showToast("Factory floor expanded", { tone: "positive" }); }
                  else { haptic.warning(); showToast(res.reason ?? "Can't expand", { tone: "negative" }); }
                }}>{format(cost)}</button>
              );
            })()}
          </div>
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
  const [open, setOpen] = useState(false);
  const cardLineOk = lineComplete(d.floor);
  return (
    <div className="fcard">
      <button className="fcard__tap" onClick={() => { haptic.light(); setOpen(true); }} aria-label="Open factory mode">
        <FloorMinimap floor={d.floor} lineOk={cardLineOk} running={d.active} />
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
