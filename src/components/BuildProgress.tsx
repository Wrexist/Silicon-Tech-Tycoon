// Immersive manufacturing readout for a product on the line: the device sits inside a circular
// progress ring (a glowing "factory halo") that fills as the run is built, with a live stage label
// — Sourcing → Tooling → Assembly → QA → Packaging — so the wait reads as a real process, not a
// silent bar. Pure presentational; driven by the BuildJob's weeksElapsed / totalWeeks.
import { Boxes, Wrench, Cog, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { supplierFor } from "../engine/suppliers.ts";
import { factoryFor, DEFAULT_FACTORY_ID } from "../engine/factories.ts";
import { DEFAULT_SUPPLIER_ID } from "../engine/suppliers.ts";
import type { BuildJob } from "../engine/types.ts";
import "./buildProgress.css";

export type Stage = { from: number; label: string; sub: string; icon: LucideIcon };

// Ordered manufacturing stages, keyed off the build's completion fraction. The last stage whose
// `from` is ≤ progress is the active one, so adding/retiming stages stays a one-line edit.
// Exported: the Factory World mirrors these exact stages on its floor (one source of truth).
export const STAGES: Stage[] = [
  { from: 0.0, label: "Sourcing components", sub: "Chips, panels & cells inbound", icon: Boxes },
  { from: 0.2, label: "Tooling & setup", sub: "Calibrating the line", icon: Wrench },
  { from: 0.45, label: "Assembly", sub: "Units coming together", icon: Cog },
  { from: 0.75, label: "Quality assurance", sub: "Testing every unit", icon: ShieldCheck },
  { from: 0.92, label: "Packaging & shipping", sub: "Boxing the run", icon: Truck },
];

export function stageFor(frac: number): Stage {
  let s = STAGES[0];
  for (const cand of STAGES) if (frac >= cand.from) s = cand;
  return s;
}

const RING_R = 33; // radius in the 80×80 viewBox
const RING_C = 2 * Math.PI * RING_R;

export function BuildProgress({ job }: { job: BuildJob }) {
  const frac = Math.max(0, Math.min(1, job.weeksElapsed / Math.max(1e-6, job.totalWeeks)));
  const pct = Math.round(frac * 100);
  const weeksLeft = Math.max(0, Math.ceil(job.totalWeeks - job.weeksElapsed));
  const stage = stageFor(frac);
  const StageIcon = stage.icon;
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
      </div>
    </div>
  );
}
