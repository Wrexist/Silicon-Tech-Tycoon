// Factory Mode F1 (FACTORY_MODE_PLAN.md) — the top-down tile factory from the reference
// guide: a machine-and-conveyor map with Current Order + Factory Stats panels, a right tool
// rail (Build/Upgrades/Research/Stats), a raw-materials tray, BOOST (the real rushBuild
// lever), truck and Shop along the bottom. Fully data-driven off the live sim; the map
// itself is an authored starter layout until Build mode lands in F2.
// Parametric SVG only (zero image assets); every animation sim-gated + reduced-motion safe.
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3, BatteryCharging, Bot, Camera, CodeXml, Cpu, FlaskConical, Hammer, Layers3,
  Lock, Maximize2, Monitor, ShoppingCart, Truck, X, Zap,
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
  };
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ------------------------------ the tile map ------------------------------ */

const T = 48; // tile size

/** A top-view machine block: rounded body, inner detail, status LED, soft shadow. */
function Machine({ x, y, w = 1.6, kind, hot }: { x: number; y: number; w?: number; kind: "assembler" | "arm" | "qa" | "charger"; hot: boolean }) {
  const s = w * T;
  return (
    <g transform={`translate(${x * T} ${y * T})`} className={`fm__machine${hot ? " fm__machine--hot" : ""}`}>
      <rect x={4} y={s * 0.12} width={s} height={s * 0.92} rx={10} className="fm__m-shadow" />
      <rect x={0} y={0} width={s} height={s} rx={10} className="fm__m-body" />
      <rect x={5} y={5} width={s - 10} height={s - 10} rx={7} className="fm__m-inner" />
      {kind === "assembler" && (
        <>
          <rect x={s * 0.2} y={s * 0.22} width={s * 0.6} height={s * 0.2} rx={4} className="fm__m-slot" />
          <g className="fm__m-press"><rect x={s * 0.32} y={s * 0.5} width={s * 0.36} height={s * 0.26} rx={4} className="fm__m-tool" /></g>
        </>
      )}
      {kind === "arm" && (
        <>
          <circle cx={s / 2} cy={s / 2} r={s * 0.2} className="fm__m-hub" />
          <g className="fm__m-rot" style={{ transformOrigin: `${s / 2}px ${s / 2}px` }}>
            <rect x={s / 2 - 4} y={s * 0.1} width={8} height={s * 0.4} rx={4} className="fm__m-armseg" />
            <circle cx={s / 2} cy={s * 0.12} r={6} className="fm__m-claw" />
          </g>
        </>
      )}
      {kind === "qa" && (
        <>
          <rect x={s * 0.16} y={s * 0.42} width={s * 0.68} height={s * 0.16} rx={4} className="fm__m-slot" />
          <line x1={s * 0.2} y1={s * 0.5} x2={s * 0.8} y2={s * 0.5} className="fm__m-scan" />
        </>
      )}
      {kind === "charger" && (
        <>
          <rect x={s * 0.3} y={s * 0.2} width={s * 0.4} height={s * 0.6} rx={5} className="fm__m-slot" />
          <path d={`M ${s * 0.52} ${s * 0.3} l -10 ${s * 0.22} h 8 l -4 ${s * 0.18} l 14 -${s * 0.24} h -8 z`} className="fm__m-bolt" />
        </>
      )}
      <circle cx={s - 10} cy={10} r={4} className="fm__m-led" />
    </g>
  );
}

/** A straight belt segment (tiles), horizontal or vertical, with animated lane + chevrons. */
function Belt({ x, y, len, dir }: { x: number; y: number; len: number; dir: "e" | "w" | "s" | "n" }) {
  const horiz = dir === "e" || dir === "w";
  const wpx = horiz ? len * T : T;
  const hpx = horiz ? T : len * T;
  const rev = dir === "w" || dir === "n";
  const chevrons = Array.from({ length: len }, (_, i) => i * T + T / 2);
  return (
    <g transform={`translate(${x * T} ${y * T})`}>
      <rect x={0} y={0} width={wpx} height={hpx} rx={8} className="fm__belt" />
      {horiz ? (
        <line x1={8} y1={T / 2} x2={wpx - 8} y2={T / 2} className={`fm__lane${rev ? " fm__lane--rev" : ""}`} strokeDasharray="10 10" />
      ) : (
        <line x1={T / 2} y1={8} x2={T / 2} y2={hpx - 8} className={`fm__lane${rev ? " fm__lane--rev" : ""}`} strokeDasharray="10 10" />
      )}
      {chevrons.map((c) => (
        <path
          key={c}
          className="fm__chev"
          d={horiz ? `M ${c - 4} ${T / 2 - 6} l 8 6 l -8 6` : `M ${T / 2 - 6} ${c - 4} l 6 8 l 6 -8`}
          transform={rev ? (horiz ? `rotate(180 ${c} ${T / 2})` : `rotate(180 ${T / 2} ${c})`) : undefined}
        />
      ))}
    </g>
  );
}

function Storage({ x, y, stacks }: { x: number; y: number; stacks: number }) {
  return (
    <g transform={`translate(${x * T} ${y * T})`}>
      {Array.from({ length: Math.max(1, Math.min(4, stacks)) }, (_, i) => (
        <g key={i} transform={`translate(${(i % 2) * 30} ${Math.floor(i / 2) * 30})`} className={stacks > 0 ? undefined : "fm__dimmed"}>
          <rect x={0} y={0} width={26} height={26} rx={4} className="fm__crate" />
          <line x1={0} y1={13} x2={26} y2={13} className="fm__crate-line" />
          <line x1={13} y1={0} x2={13} y2={26} className="fm__crate-line" />
        </g>
      ))}
    </g>
  );
}

export function FactoryMap({ compact = false, fill = false }: { compact?: boolean; fill?: boolean }) {
  const { active, stageIdx, overtime, readyCount, selling, robotTier, fac } = useFactoryData();
  const mood = overtime ? " fm--overtime" : active ? " fm--running" : " fm--idle";
  return (
    <svg
      className={`fm${mood}${compact ? " fm--compact" : ""}`}
      viewBox="0 0 720 480"
      preserveAspectRatio={fill ? "xMidYMid slice" : "xMidYMid meet"}
      role="img"
      aria-label={active ? `Factory map at ${fac.name}: production running` : `Factory map at ${fac.name}: lines idle`}
    >
      {/* ground: grass fringe → asphalt pad → tile grid */}
      <rect x={0} y={0} width={720} height={480} className="fm__grass" />
      {[[40, 26], [640, 40], [80, 430], [660, 420]].map(([bx, by], i) => (
        <circle key={i} cx={bx} cy={by} r={10 + (i % 2) * 4} className="fm__bush" />
      ))}
      <rect x={24} y={24} width={672} height={432} rx={14} className="fm__pad" />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * T + 24} y1={24} x2={(i + 1) * T + 24} y2={456} className="fm__grid" />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={`h${i}`} x1={24} y1={(i + 1) * T + 24} x2={696} y2={(i + 1) * T + 24} className="fm__grid" />
      ))}

      {/* authored starter layout (F2 makes this player-built) */}
      <g transform="translate(24 24)">
        {/* main conveyor loop */}
        <Belt x={1.5} y={1.5} len={9} dir="e" />
        <Belt x={10.5} y={2.5} len={4} dir="s" />
        <Belt x={2.5} y={6.5} len={9} dir="w" />
        <Belt x={1.5} y={2.5} len={4} dir="n" />
        {/* spur to the dock */}
        <Belt x={11.5} y={5} len={2} dir="e" />

        {/* machines around the loop; the active build stage lights its machine */}
        <Machine x={3.2} y={2.9} kind="assembler" hot={stageIdx === 1} />
        <Machine x={6.2} y={2.9} kind="arm" hot={stageIdx === 2} />
        <Machine x={8.6} y={2.9} kind="qa" hot={stageIdx === 3} />
        <Machine x={11.6} y={0.6} w={1.1} kind="charger" hot={false} />

        {/* storage corner — pallet grid tracks the ready shelf */}
        <g className={stageIdx === 4 && active ? "fm__pack" : undefined}>
          <Storage x={0.6} y={7.9} stacks={readyCount + 1} />
        </g>

        {/* items flowing on the top belt while running */}
        {active && [0, 1, 2].map((i) => (
          <g key={i} className="fm__item" style={{ animationDelay: `${i * 2.4}s` }}>
            <rect x={-8} y={84} width={16} height={16} rx={3} className="fm__crate" />
          </g>
        ))}

        {/* AGVs: one per Robotics tier, patrolling the bottom lane */}
        {Array.from({ length: Math.min(3, robotTier) }, (_, i) => (
          <g key={i} className="fm__agv" style={{ animationDelay: `${i * 4.2}s` }}>
            <rect x={-10} y={-7} width={20} height={14} rx={5} className="fm__agv-body" />
            <circle cx={0} cy={0} r={2.6} className="fm__agv-dot" />
          </g>
        ))}

        {/* dock road + truck (idles while anything is selling) */}
        <rect x={13 * T + 2} y={4.6 * T} width={T - 4} height={4.4 * T} rx={8} className="fm__road" />
        <g className={`fm__truck${selling ? " fm__truck--live" : ""}`}>
          <rect x={0} y={0} width={26} height={44} rx={6} className="fm__truck-trailer" />
          <rect x={2} y={44} width={22} height={14} rx={5} className="fm__truck-cab" />
        </g>
      </g>
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

  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

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
          <Suspense fallback={<FactoryMap />}>
            <Factory3D
              active={d.active}
              stageIdx={d.stageIdx}
              robotTier={d.robotTier}
              readyCount={d.readyCount}
              selling={d.selling}
              overtime={d.overtime}
              onContextLost={() => setGlLost(true)}
            />
          </Suspense>
        ) : (
          <FactoryMap />
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
        <div className="fmode__panel">
          <span className="fmode__panel-title">Current order</span>
          {d.lead ? (
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
          <span className="fmode__panel-title">Factory stats</span>
          <div className="fmode__stat"><span>Units/wk</span><span className="tnum">{d.unitsWk.toLocaleString()}</span></div>
          <div className="fmode__stat"><span>Revenue/wk</span><span className="tnum">{format(d.revenueWk)}</span></div>
          <div className="fmode__stat"><span>Expenses/wk</span><span className="tnum">{format(d.expensesWk)}</span></div>
          <div className="fmode__stat"><span>Profit/wk</span><span className={`tnum ${toDollars(d.profitWk) >= 0 ? "fmode__pos" : "fmode__neg"}`}>{format(d.profitWk)}</span></div>
        </div>
      </div>

      {/* right tool rail */}
      <div className="fmode__rail">
        <button className="fmode__tool fmode__tool--soon" onClick={() => showToast("Build mode arrives with the next factory update", { tone: "neutral" })}>
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

      {/* bottom strip */}
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
  return (
    <div className="fcard">
      <button className="fcard__tap" onClick={() => { haptic.light(); setOpen(true); }} aria-label="Open factory mode">
        <FactoryMap compact />
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
