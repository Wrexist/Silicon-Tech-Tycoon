// Immersive manufacturing readout for a product on the line: the device sits inside a circular
// progress ring (a glowing "factory halo") that fills as the run is built, with a live stage label
// — Sourcing → Tooling → Assembly → QA → Packaging — so the wait reads as a real process, not a
// silent bar. Pure presentational; driven by the BuildJob's weeksElapsed / totalWeeks.
import { useEffect, useState } from "react";
import {
  Boxes, Stamp, Layers3, Cog, ShieldCheck, Truck, Wrench, Keyboard, Fan, Watch,
  Monitor, ScanLine, CircuitBoard, type LucideIcon,
} from "lucide-react";
import type { CategoryId } from "../engine/types.ts";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { supplierFor } from "../engine/suppliers.ts";
import { factoryFor, DEFAULT_FACTORY_ID } from "../engine/factories.ts";
import { DEFAULT_SUPPLIER_ID } from "../engine/suppliers.ts";
import { lineFor, stageForLine, stageIndexForLine } from "../engine/assemblyLine.ts";
import { BALANCE } from "../engine/balance.ts";
import { useGame } from "../state/useGame.tsx";
import type { BuildJob } from "../engine/types.ts";
import "./buildProgress.css";

// Icon key → glyph. The engine's recipes are icon-free (pure data); the presentation layer owns
// the glyphs. One map shared by the ring's stage label and the StageTrail stepper.
export const STAGE_ICONS: Record<string, LucideIcon> = {
  source: Boxes, press: Stamp, bond: Layers3, board: CircuitBoard, chassis: Wrench,
  keyboard: Keyboard, cooling: Fan, sensor: Watch, panel: Monitor, calibrate: ScanLine,
  qa: ShieldCheck, pack: Truck,
};
const stageIcon = (key: string): LucideIcon => STAGE_ICONS[key] ?? Cog;

/** The stage stepper — the device's whole build pipeline as a row of icon nodes that fill left to
 *  right as the run progresses, so the wait is "nice to follow": you see every machine, which are
 *  done, and which is running now. Device-specific (a laptop shows a Chassis Mill + Keyboard Deck a
 *  phone never does). With `labeled`, each node captions its machine's name — a clean readout of
 *  exactly which machines the device needs. Compact + reduced-motion safe. */
export function StageTrail({ category, frac, tone = "accent", labeled = false }: { category: CategoryId; frac: number; tone?: "accent" | "positive"; labeled?: boolean }) {
  const stages = lineFor(category);
  const activeIdx = stageIndexForLine(category, frac);
  return (
    <ol className={`strail strail--${tone}${labeled ? " strail--labeled" : ""}`} aria-label={`Machines for this ${category}`}>
      {stages.map((s, i) => {
        const Icon = stageIcon(s.icon);
        const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
        return (
          <li
            key={s.key}
            className={`strail__step strail__step--${state}`}
            aria-current={state === "active" ? "step" : undefined}
            title={s.machine}
          >
            <span className="strail__row">
              <span className="strail__node"><Icon size={12} aria-hidden /></span>
              {i < stages.length - 1 && <span className={`strail__bar${i < activeIdx ? " strail__bar--done" : ""}`} aria-hidden />}
            </span>
            {labeled && <span className="strail__cap">{s.short}</span>}
          </li>
        );
      })}
    </ol>
  );
}

const RING_R = 33; // radius in the 80×80 viewBox
const RING_C = 2 * Math.PI * RING_R;

/** Wall-clock-smoothed build weeks. The sim only moves `weeksElapsed` in whole-week ticks, so the
 *  ring would jump 0% → 33% → 67% on a 3-week build. This interpolates WITHIN the current week
 *  using the real tick cadence (pause freezes it, fast-forward speeds it up), capped just short of
 *  the next week so the sim's own tick always lands ahead of the estimate — the ring counts up
 *  continuously from 0% and is never caught claiming progress the sim hasn't made. */
function useSmoothWeeks(weeksElapsed: number, totalWeeks: number): number {
  const { paused, fast, skipping } = useGame();
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The estimate is keyed to the week it was made for — a week the sim has since advanced past
  // reads as 0, so there's never a frame where the old fraction rides on the new week.
  const [est, setEst] = useState({ week: weeksElapsed, sub: 0 });
  const sub = est.week === weeksElapsed ? est.sub : 0;
  useEffect(() => {
    if (paused || reduced || weeksElapsed >= totalWeeks) return; // pause freezes; reduced motion steps
    const tickMs = (BALANCE.secondsPerTick / (fast || skipping ? BALANCE.fastMultiplier : 1)) * 1000;
    const t0 = performance.now();
    const sub0 = sub; // resume from where the estimate froze (0 on a fresh week)
    const id = setInterval(() => {
      setEst({ week: weeksElapsed, sub: Math.min(0.97, sub0 + (performance.now() - t0) / tickMs) });
    }, 120); // ~8fps — the CSS transition on the ring smooths the rest
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sub` is read once per (re)start on purpose
  }, [paused, fast, skipping, reduced, weeksElapsed, totalWeeks]);
  return Math.min(totalWeeks, weeksElapsed + (reduced ? 0 : sub));
}

export function BuildProgress({ job }: { job: BuildJob }) {
  const smoothWeeks = useSmoothWeeks(job.weeksElapsed, job.totalWeeks);
  const frac = Math.max(0, Math.min(1, smoothWeeks / Math.max(1e-6, job.totalWeeks)));
  const pct = Math.round(frac * 100);
  const weeksLeft = Math.max(0, Math.ceil(job.totalWeeks - job.weeksElapsed));
  const stage = stageForLine(job.product.category, frac);
  const StageIcon = stageIcon(stage.icon);
  const nearDone = frac >= 0.92;
  // Surface the player's supply-chain choices in the live stage: the supplier while sourcing, the
  // factory while tooling/assembling. Only when non-default, so a standard build stays clean.
  const customSupplier = (job.product.supplierId ?? DEFAULT_SUPPLIER_ID) !== DEFAULT_SUPPLIER_ID;
  const customFactory = (job.product.factoryId ?? DEFAULT_FACTORY_ID) !== DEFAULT_FACTORY_ID;
  let stageSub = stage.sub;
  if (stage.from < 0.2 && customSupplier) stageSub = `via ${supplierFor(job.product.supplierId).name}`;
  else if (stage.from >= 0.2 && stage.from < 0.75 && customFactory) stageSub = `at ${factoryFor(job.product.factoryId).name}`;
  // Stroke offset draws the ring clockwise from the top; transitions smoothly between weekly ticks.
  const offset = RING_C * (1 - frac);

  return (
    <div className={`bprog${nearDone ? " bprog--near" : ""}`}>
      <div className="bprog__ring" style={{ "--bprog-frac": frac } as React.CSSProperties}>
        <span className="bprog__halo" aria-hidden />
        {/* continuous "line is running" motion — a sweeping accent arc orbiting the ring */}
        <span className="bprog__sweep" aria-hidden />
        <svg className="bprog__svg" viewBox="0 0 80 80" aria-hidden>
          <circle className="bprog__track" cx="40" cy="40" r={RING_R} />
          <circle
            className="bprog__fill"
            cx="40"
            cy="40"
            r={RING_R}
            style={{ strokeDasharray: RING_C, strokeDashoffset: offset }}
          />
        </svg>
        <span className="bprog__device">
          <DeviceRenderer product={job.product} size={40} idle />
        </span>
        <span className="bprog__pct tnum" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${job.product.name} build progress`}>
          {pct}<span className="bprog__pct-sign">%</span>
        </span>
      </div>

      <div className="bprog__body">
        <span className="bprog__name">{job.product.name}</span>
        <span className="bprog__stage" key={stage.label}>
          <span className="bprog__stage-icon"><StageIcon size={14} aria-hidden /></span>
          <span className="bprog__stage-text">
            <b>{stage.label}</b>
            <small>{stageSub}</small>
          </span>
        </span>
        <span className="bprog__meta tnum">
          {weeksLeft > 0 ? `${weeksLeft} wk left` : "Finishing up"}
          {job.plannedUnits != null && <span className="bprog__units"> · {job.plannedUnits.toLocaleString()} units</span>}
        </span>
        <StageTrail category={job.product.category} frac={frac} tone={nearDone ? "positive" : "accent"} labeled />
      </div>
    </div>
  );
}
