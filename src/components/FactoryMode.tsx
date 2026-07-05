// Factory Mode F1 (FACTORY_MODE_PLAN.md) — the top-down tile factory from the reference
// guide: a machine-and-conveyor map with Current Order + Factory Stats panels, a right tool
// rail (Build/Upgrades/Research/Stats), a raw-materials tray, BOOST (the real rushBuild
// lever), truck and Shop along the bottom. Fully data-driven off the live sim; the map
// itself is an authored starter layout until Build mode lands in F2.
// Parametric SVG only (zero image assets); every animation sim-gated + reduced-motion safe.
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3, BatteryCharging, Bot, Camera, ChevronDown, CodeXml, Cpu, FlaskConical, Hammer,
  Layers3, Lock, Maximize2, Monitor, ShoppingCart, Truck, X, Zap,
} from "lucide-react";
import { useGame } from "../state/useGame.tsx";
import { burn, industryRank, nextWeekRevenue } from "../state/gameState.ts";
import { factoryFor, DEFAULT_FACTORY_ID, FACTORIES } from "../engine/factories.ts";
import { nextUpgradeCost, upgradeLockedBy, upgradeLine } from "../engine/upgrades.ts";
import { projectById } from "../engine/research.ts";
import { CATEGORIES } from "../engine/catalogs.ts";
import { format, sub, toDollars } from "../engine/money.ts";
import type { ComponentKind, FactoryId } from "../engine/types.ts";
import type { Tab } from "./BottomNav.tsx";
import { STAGES, stageFor } from "./BuildProgress.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { Sheet, useDialogFocus } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { webglSupported, prefersReducedMotion } from "../garage3d/support.ts";
import { MACHINE_DEFS, BELT_COST, beltChain, lineComplete, type BeltDir, type FactoryFloor as GameFloor, type MachineKind } from "../engine/factoryFloor.ts";
import { useSettings } from "../state/settings.ts";

// three.js stays in its own lazy chunk (the garage3d rule); the SVG map is the fallback for
// no-WebGL / reduced-motion / 3D-off, and the Suspense placeholder while the chunk loads.
const Factory3D = lazy(() => import("./Factory3D.tsx"));
import "./factoryMode.css";

/* ------------------------------- shared data ------------------------------- */

const MATERIAL_ICONS: Record<ComponentKind, typeof Cpu> = {
  chip: Cpu, display: Monitor, battery: BatteryCharging,
  materials: Layers3, software: CodeXml, camera: Camera,
};

function useFactoryData() {
  const game = useGame();
  const { state } = game;
  const lead = state.building[0] ?? null;
  const active = state.building.length > 0;
  const progress = lead ? Math.min(1, lead.weeksElapsed / Math.max(1, lead.totalWeeks)) : 0;
  const stage = lead ? stageFor(progress) : null;
  const stageIdx = stage ? STAGES.indexOf(stage) : -1;
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

  return {
    game, state, lead, active, progress, stage, stageIdx, weeksLeft, readyCount, selling,
    fac, util, overtime, robotTier, unitsWk, revenueWk, expensesWk, profitWk, materials,
    floor: state.factoryFloor,
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
  press: "var(--fmini-press)",
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
  const [sheet, setSheet] = useState<null | "upgrades" | "stats" | "shop">(null);
  const settings = useSettings();
  const [glLost, setGlLost] = useState(false);
  const use3d = settings.garage3d && webglSupported() && !prefersReducedMotion() && !glLost;
  // F2 Build mode — the selected tool paints cells on the 3D pad.
  const [buildTool, setBuildTool] = useState<null | MachineKind | "belt" | "erase">(null);
  const [beltDir, setBeltDir] = useState<BeltDir>("e");
  const [flash, setFlash] = useState<{ c: number; r: number; ok: boolean; n: number } | null>(null);
  // Panels fold so the floor stays visible on portrait — the scene is the star, not the chrome.
  const [orderOpen, setOrderOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);
  const { buyFloorMachine, buyFloorBelt, clearFloorCell } = d.game;
  const lineOk = lineComplete(d.floor);
  const onTapCell = (c: number, r: number) => {
    if (!buildTool) return;
    if (buildTool === "erase") {
      clearFloorCell(c, r);
      haptic.light();
      setFlash((f) => ({ c, r, ok: true, n: (f?.n ?? 0) + 1 }));
      return;
    }
    const res = buildTool === "belt" ? buyFloorBelt(c, r, beltDir) : buyFloorMachine(buildTool, c, r);
    setFlash((f) => ({ c, r, ok: res.ok, n: (f?.n ?? 0) + 1 }));
    if (res.ok) { haptic.light(); if (buildTool !== "belt") { sfx("build"); haptic.success(); } }
    else { haptic.warning(); showToast(res.reason ?? "Can't build there", { tone: "negative" }); }
  };

  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (buildTool != null) setBuildTool(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, buildTool]);

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
              stageIdx={d.stageIdx}
              robotTier={d.robotTier}
              readyCount={d.readyCount}
              selling={d.selling}
              overtime={d.overtime}
              floor={d.floor}
              lineOk={lineOk}
              buildMode={buildTool != null}
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
        <span className="fmode__chip tnum"><FlaskConical size={12} aria-hidden /> {Math.floor(state.researchPoints)}</span>
        {d.util != null && (
          <span className={`fmode__cap${d.overtime ? " fmode__cap--hot" : ""}`} title="Line capacity this week">
            <Zap size={12} aria-hidden />
            <span className="fmode__cap-bar"><span className="fmode__cap-fill" style={{ width: `${Math.min(100, Math.round(d.util * 100))}%` }} /></span>
            <span className="tnum">{Math.round(d.util * 100)}%</span>
          </span>
        )}
        <button className="fmode__close" aria-label="Close factory" onClick={() => { haptic.light(); onClose(); }}><X size={20} /></button>
      </div>

      {/* left panels */}
      <div className="fmode__left">
        {!lineOk && (
          <div className="fmode__panel fmode__panel--warn">
            <span className="fmode__panel-title">Line stopped</span>
            <p className="fmode__empty">The conveyor doesn't connect the Intake Hopper to the Packing Station. Fix it in Build.</p>
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
              </div>
            </div>
          ) : (
            <p className="fmode__empty">No active order. Plan a production run in the Design Lab.</p>
          )}
        </div>
        <div className="fmode__panel">
          <button className="fmode__panel-head" aria-expanded={statsOpen} onClick={() => { haptic.light(); setStatsOpen(!statsOpen); }}>
            <span className="fmode__panel-title">Factory stats</span>
            <ChevronDown size={14} className={`fmode__panel-caret${statsOpen ? " fmode__panel-caret--open" : ""}`} aria-hidden />
          </button>
          {statsOpen && (<>
          <div className="fmode__stat"><span>Units/wk</span><span className="tnum">{d.unitsWk.toLocaleString()}</span></div>
          <div className="fmode__stat"><span>Revenue/wk</span><span className="tnum">{format(d.revenueWk)}</span></div>
          <div className="fmode__stat"><span>Expenses/wk</span><span className="tnum">{format(d.expensesWk)}</span></div>
          <div className="fmode__stat"><span>Profit/wk</span><span className={`tnum ${toDollars(d.profitWk) >= 0 ? "fmode__pos" : "fmode__neg"}`}>{format(d.profitWk)}</span></div>
          </>)}
        </div>
      </div>

      {/* right tool rail */}
      <div className="fmode__rail">
        <button
          className={`fmode__tool${buildTool != null ? " fmode__tool--on" : ""}`}
          onClick={() => { haptic.light(); setBuildTool(buildTool != null ? null : "belt"); }}
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
        <button className="fmode__tool" onClick={() => { haptic.light(); setSheet("stats"); }}>
          <BarChart3 size={18} /><span>Stats</span>
        </button>
      </div>

      {/* bottom strip — swaps to the build toolbar while a tool is armed */}
      {buildTool != null && (
        <div className="fmode__bottom fmode__bottom--build">
          <p className="fmode__buildhint">Belts carry the line from the Intake Hopper to the Packing Station. Tap a belt again to re-aim it; Erase refunds half.</p>
          <div className="fmode__tools">
            <button
              className={`fmode__toolchip${buildTool === "belt" ? " fmode__toolchip--on" : ""}`}
              onClick={() => { haptic.light(); setBuildTool("belt"); }}
            >
              Belt · {format(BELT_COST)}
            </button>
            <button
              className="fmode__toolchip"
              aria-label="Belt direction"
              onClick={() => { haptic.light(); setBeltDir(beltDir === "e" ? "s" : beltDir === "s" ? "w" : beltDir === "w" ? "n" : "e"); setBuildTool("belt"); }}
            >
              {beltDir === "e" ? "→" : beltDir === "s" ? "↓" : beltDir === "w" ? "←" : "↑"}
            </button>
            {(Object.keys(MACHINE_DEFS) as MachineKind[]).map((k) => (
              <button
                key={k}
                className={`fmode__toolchip${buildTool === k ? " fmode__toolchip--on" : ""}`}
                onClick={() => { haptic.light(); setBuildTool(k); }}
              >
                {MACHINE_DEFS[k].name.split(" ")[0]} · {format(MACHINE_DEFS[k].cost)}
              </button>
            ))}
            <button
              className={`fmode__toolchip fmode__toolchip--danger${buildTool === "erase" ? " fmode__toolchip--on" : ""}`}
              onClick={() => { haptic.light(); setBuildTool("erase"); }}
            >
              Erase
            </button>
          </div>
          <button className="fmode__boost" onClick={() => { haptic.light(); setBuildTool(null); }}>Done</button>
        </div>
      )}
      {buildTool == null && (
      <div className="fmode__bottom">
        <div className="fmode__mats" aria-label="Raw materials committed to production">
          {(Object.keys(MATERIAL_ICONS) as ComponentKind[]).map((kind) => {
            const Icon = MATERIAL_ICONS[kind];
            const n = d.materials.get(kind) ?? 0;
            return (
              <span key={kind} className={`fmode__mat${n === 0 ? " fmode__mat--zero" : ""}`} title={kind}>
                <Icon size={14} aria-hidden /><span className="tnum">{fmtCount(n)}</span>
              </span>
            );
          })}
        </div>
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
