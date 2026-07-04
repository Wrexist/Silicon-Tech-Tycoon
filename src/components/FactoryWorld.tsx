// Factory World (P1 of FACTORY_WORLD_PLAN.md) — a living 2.5D manufacturing floor that
// visualizes the sim the game already runs: the conveyor works while builds are in
// production, pallets stack with the ready shelf, the truck idles while products sell,
// and the floor goes amber when a run exceeds the line's weekly capacity (overtime).
// Pure parametric SVG (zero image assets, the IsoScene discipline); every animation is
// class-gated on real sim state and fully disabled under prefers-reduced-motion.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, PackageCheck, TrendingUp, Wrench, X } from "lucide-react";
import { useGame } from "../state/useGame.tsx";
import { factoryFor, DEFAULT_FACTORY_ID } from "../engine/factories.ts";
import type { FactoryId } from "../engine/types.ts";
import { haptic } from "../design/haptics.ts";
import "./factoryWorld.css";

/* ---------------------------------- scene ---------------------------------- */

interface SceneProps {
  /** A production run is live — belt, crates, arm, press and scanner work. */
  active: boolean;
  /** 0..1 progress of the lead build (lights up the matching station harder). */
  progress: number;
  /** Ready-to-launch products → pallet stacks at the dock (0..3 rendered). */
  readyCount: number;
  /** Any launched product still selling → the truck is docked and idling. */
  selling: boolean;
  /** Lead run exceeds the line's weekly capacity → amber overtime mood. */
  overtime: boolean;
  factoryName: string;
}

function Crate({ x, delay }: { x: number; delay: number }) {
  // Travels the belt's local X via CSS; the parent group carries the 2.5D tilt.
  return (
    <g className="fw__crate" style={{ animationDelay: `${delay}s` }} transform={`translate(${x} 0)`}>
      <g transform="rotate(11)">
        <rect x={-9} y={-20} width={18} height={14} rx={2} className="fw__crate-box" />
        <line x1={-9} y1={-13} x2={9} y2={-13} className="fw__crate-strap" />
      </g>
    </g>
  );
}

function PalletStack({ x, y, layers }: { x: number; y: number; layers: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={10} width={44} height={5} rx={1.5} className="fw__pallet" />
      {Array.from({ length: layers }, (_, i) => (
        <rect key={i} x={4 + (i % 2) * 3} y={10 - (i + 1) * 11} width={36} height={10} rx={2} className="fw__crate-box" />
      ))}
    </g>
  );
}

export function FactoryScene({ active, progress, readyCount, selling, overtime, factoryName }: SceneProps) {
  const mood = overtime ? " fw--overtime" : active ? " fw--running" : " fw--idle";
  // Which station is "hot" right now, mapped from real build progress (P2 refines to stages).
  const hot = progress < 0.4 ? 0 : progress < 0.75 ? 1 : 2;
  return (
    <svg
      className={`fw${mood}`}
      viewBox="0 0 760 430"
      role="img"
      aria-label={
        active
          ? `Factory floor at ${factoryName}: production running${overtime ? " on overtime" : ""}, ${readyCount} ready to ship`
          : `Factory floor at ${factoryName}: lines idle`
      }
    >
      {/* ---- shell: back wall, windows, roof trusses ---- */}
      <rect x={0} y={0} width={760} height={430} className="fw__air" />
      <polygon points="0,58 760,58 760,240 0,240" className="fw__wall" />
      <polygon points="0,240 760,240 760,430 0,430" className="fw__floor" />
      {[90, 300, 510].map((wx) => (
        <g key={wx}>
          <rect x={wx} y={86} width={130} height={78} rx={4} className="fw__window" />
          <line x1={wx + 65} y1={86} x2={wx + 65} y2={164} className="fw__window-bar" />
          <line x1={wx} y1={125} x2={wx + 130} y2={125} className="fw__window-bar" />
        </g>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={i * 253} y1={58} x2={i * 253 + 60} y2={0} className="fw__truss" />
      ))}
      <line x1={0} y1={58} x2={760} y2={58} className="fw__truss fw__truss--beam" />
      {[286, 336, 388].map((fy) => (
        <line key={fy} x1={0} y1={fy} x2={760} y2={fy} className="fw__floorline" />
      ))}
      {/* floor sheen + safety stripes at the dock lane */}
      {[290, 336].map((sy) => (
        <line key={sy} x1={575} y1={sy} x2={760} y2={sy + 26} className="fw__stripe" strokeDasharray="14 10" />
      ))}

      {/* ---- pendant industrial lights (dim when idle) ---- */}
      {[150, 380, 610].map((lx, i) => (
        <g key={lx} className="fw__lamp" style={{ animationDelay: `${i * 0.9}s` }}>
          <line x1={lx} y1={0} x2={lx} y2={40} className="fw__lamp-cord" />
          <path d={`M ${lx - 16} 40 h32 l-6 10 h-20 z`} className="fw__lamp-shade" />
          <polygon points={`${lx - 26},52 ${lx + 26},52 ${lx + 52},220 ${lx - 52},220`} className="fw__lamp-cone" />
        </g>
      ))}

      {/* ---- signage ---- */}
      <rect x={288} y={30} width={184} height={22} rx={5} className="fw__sign" />
      <text x={380} y={45} textAnchor="middle" className="fw__sign-text">{factoryName.toUpperCase()}</text>

      {/* ---- steam vent ---- */}
      <rect x={38} y={196} width={26} height={44} rx={3} className="fw__vent" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={51} cy={190} r={7 + i * 2} className="fw__steam" style={{ animationDelay: `${i * 1.1}s` }} />
      ))}

      {/* ---- control panel with blinking LEDs ---- */}
      <g transform="translate(668 176)">
        <rect x={0} y={0} width={54} height={64} rx={5} className="fw__panel" />
        <rect x={7} y={8} width={40} height={18} rx={3} className="fw__panel-screen" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={13 + i * 14} cy={40} r={3.5} className={`fw__led fw__led--${i}`} />
        ))}
        <rect x={9} y={50} width={36} height={6} rx={3} className="fw__panel-slot" />
      </g>

      {/* ---- the conveyor line (tilted group = the 2.5D read) ---- */}
      <g transform="translate(96 306) rotate(-11)">
        {/* legs */}
        {[20, 130, 240, 350, 460].map((lx) => (
          <g key={lx} transform={`rotate(11 ${lx + 3.5} 8)`}>
            <rect x={lx} y={8} width={7} height={46} className="fw__leg" />
            <rect x={lx - 5} y={52} width={17} height={5} rx={2} className="fw__leg-foot" />
          </g>
        ))}
        {/* bed + rails */}
        <rect x={0} y={-10} width={490} height={20} rx={7} className="fw__belt-bed" />
        <line x1={8} y1={-10} x2={482} y2={-10} className="fw__rail" />
        <line x1={8} y1={10} x2={482} y2={10} className="fw__rail" />
        {/* animated tread */}
        <line x1={10} y1={0} x2={480} y2={0} className="fw__tread" strokeDasharray="16 12" />
        {/* traveling crates (only while running) */}
        {active && [0, 1, 2, 3].map((i) => <Crate key={i} x={0} delay={i * 2.1} />)}

        {/* station 1 — robotic assembly arm */}
        <g transform="translate(120 -12) rotate(11)" className={`fw__station${hot === 0 ? " fw__station--hot" : ""}`}>
          <rect x={-12} y={-6} width={24} height={8} rx={3} className="fw__arm-base" />
          <g className="fw__arm">
            <rect x={-4} y={-40} width={8} height={36} rx={3.5} className="fw__arm-seg" />
            <g className="fw__forearm">
              <rect x={-3.5} y={-72} width={7} height={34} rx={3} className="fw__arm-seg" />
              <path d="M -8 -74 q 8 -10 16 0" className="fw__claw" />
            </g>
          </g>
        </g>

        {/* station 2 — press stamper */}
        <g transform="translate(255 -12) rotate(11)" className={`fw__station${hot === 1 ? " fw__station--hot" : ""}`}>
          <rect x={-20} y={-78} width={8} height={70} className="fw__press-post" />
          <rect x={12} y={-78} width={8} height={70} className="fw__press-post" />
          <rect x={-24} y={-84} width={48} height={10} rx={3} className="fw__press-head" />
          <g className="fw__press">
            <rect x={-14} y={-70} width={28} height={22} rx={3} className="fw__press-block" />
            <polygon points="-8,-48 8,-48 0,-40" className="fw__press-tip" />
          </g>
          <circle cx={0} cy={-36} r={5} className="fw__spark" />
        </g>

        {/* station 3 — QA scan arch */}
        <g transform="translate(390 -12) rotate(11)" className={`fw__station${hot === 2 ? " fw__station--hot" : ""}`}>
          <path d="M -26 4 v-58 a 26 24 0 0 1 52 0 v58" className="fw__arch" />
          <line x1={-20} y1={-30} x2={20} y2={-30} className="fw__scanline" />
        </g>
      </g>

      {/* ---- shipping dock: pallets + truck ---- */}
      {readyCount > 0 && <PalletStack x={568} y={330} layers={Math.min(3, readyCount)} />}
      {readyCount > 1 && <PalletStack x={620} y={352} layers={Math.min(2, readyCount - 1)} />}
      <g className={`fw__truck${selling ? " fw__truck--live" : ""}`} transform="translate(636 268)">
        <rect x={0} y={0} width={86} height={44} rx={5} className="fw__trailer" />
        <text x={43} y={27} textAnchor="middle" className="fw__trailer-text">SHIP</text>
        <rect x={86} y={16} width={30} height={28} rx={5} className="fw__cab" />
        <rect x={92} y={21} width={14} height={11} rx={2} className="fw__cab-glass" />
        {[16, 62, 100].map((wx) => (
          <circle key={wx} cx={wx} cy={47} r={7.5} className="fw__wheel" />
        ))}
      </g>

      {/* ---- idle hint ---- */}
      {!active && (
        <text x={380} y={402} textAnchor="middle" className="fw__idle-hint">
          Lines idle — plan a production run in the Design Lab
        </text>
      )}
    </svg>
  );
}

/* --------------------------------- wrapper --------------------------------- */

/** Derives everything the scene needs from live game state, renders the status chips and
 *  the fullscreen (body-portal) immersion mode with its close control. */
export function FactoryWorld() {
  const { state } = useGame();
  const [full, setFull] = useState(false);

  const building = state.building;
  const active = building.length > 0;
  const lead = building[0] ?? null;
  const progress = lead ? Math.min(1, lead.weeksElapsed / Math.max(1, lead.totalWeeks)) : 0;
  const readyCount = state.ready.length;
  const selling = state.launched.some((l) => l.weeksElapsed < l.weeklyUnits.length);

  const facId = (lead?.product.factoryId ?? state.ownedFactories[0] ?? DEFAULT_FACTORY_ID) as FactoryId;
  const fac = factoryFor(facId);
  // Weekly demand on the line vs its capacity → utilisation + the overtime mood.
  const weeklyLoad = building.reduce((sum, b) => sum + (b.plannedUnits ?? 0) / Math.max(1, b.totalWeeks), 0);
  const util = Number.isFinite(fac.capacityPerWeek) && fac.capacityPerWeek > 0 ? weeklyLoad / fac.capacityPerWeek : null;
  const overtime = util != null && util > 1;

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const body = (
    <div className="fworld__frame">
      <FactoryScene
        active={active}
        progress={progress}
        readyCount={readyCount}
        selling={selling}
        overtime={overtime}
        factoryName={fac.name}
      />
      <div className="fworld__chips">
        <span className="fworld__chip fworld__chip--name">
          <Wrench size={12} aria-hidden /> {fac.name} · {fac.kind === "owned" ? "owned" : "contract"}
        </span>
        <span className="fworld__chip">
          {active
            ? `${building.length} run${building.length > 1 ? "s" : ""} in production${lead ? ` · ${lead.product.name} wk ${lead.weeksElapsed}/${lead.totalWeeks}` : ""}`
            : "Lines idle"}
        </span>
        {util != null && active && (
          <span className={`fworld__chip${overtime ? " fworld__chip--warn" : ""}`}>
            <TrendingUp size={12} aria-hidden /> {Math.round(util * 100)}% capacity{overtime ? " · overtime" : ""}
          </span>
        )}
        {readyCount > 0 && (
          <span className="fworld__chip fworld__chip--ready">
            <PackageCheck size={12} aria-hidden /> {readyCount} ready to ship
          </span>
        )}
      </div>
      {!full && (
        <button className="fworld__expand" aria-label="Fullscreen factory view" onClick={() => { haptic.light(); setFull(true); }}>
          <Maximize2 size={16} />
        </button>
      )}
    </div>
  );

  if (full) {
    return createPortal(
      <div className="fworld__full" role="dialog" aria-modal="true" aria-label="Factory floor, fullscreen">
        {body}
        <button className="fworld__close" aria-label="Close fullscreen" onClick={() => { haptic.light(); setFull(false); }}>
          <X size={20} />
        </button>
      </div>,
      document.body,
    );
  }
  return body;
}
