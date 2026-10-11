import { useId, type CSSProperties } from "react";
import { Clock, FlaskConical, TrendingUp, X } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { ComponentIcon } from "../design/icons.tsx";
import { CircuitMotif } from "../design/CircuitMotif.tsx";
import { AnimatedInt } from "../design/AnimatedNumber.tsx";
import { BALANCE } from "../engine/balance.ts";
import type { ComponentKind } from "../engine/types.ts";
import { researchProgress, researchWeeksLeft, weeklyRpGen } from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import "./labCore.css";

// The R&D hero — the lab's live heartbeat in one card: the active project on a glowing instrument
// ring, the RP bank feeding it, the next thing worth saving for, and the queue as pipeline slots.
// All vector (the circuit motif + an SVG ring), all colour from tokens (the screen's engineering
// accent), and every animation is decoration only: the global prefers-reduced-motion catch-all
// stills it, and nothing here reads or writes the simulation.

const R = 52;                       // ring radius in the 120×120 viewBox
const C = 2 * Math.PI * R;          // its circumference
const TICKS = 36;                   // instrument dial ticks around the ring

export interface LabGoal { name: string; rpCost: number }

export function LabCore({ goal, availableCount }: { goal: LabGoal | null; availableCount: number }) {
  const { state, cancelResearch, cancelQueuedResearch } = useGame();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, ""); // safe inside url(#…) on every engine
  const rp = Math.floor(state.researchPoints);
  const perWeek = weeklyRpGen(state);
  const active = state.activeResearch;
  const queue = state.researchQueue ?? [];
  const slots = BALANCE.research.timer.maxQueue;

  // Committed progress only (no speculative sub-week smoothing), counted exactly as the sim completes
  // research: weeks in the lab plus any crunch weeks a Team Focus rush has banked.
  const frac = researchProgress(state);
  const pct = Math.round(frac * 100);
  const left = researchWeeksLeft(state);
  const headAngle = frac * 2 * Math.PI - Math.PI / 2;
  const head: [number, number] = [60 + R * Math.cos(headAngle), 60 + R * Math.sin(headAngle)];

  const goalFrac = goal ? Math.min(1, rp / Math.max(1, goal.rpCost)) : 0;
  const goalWeeks = goal && perWeek > 0 ? Math.max(0, Math.ceil((goal.rpCost - rp) / perWeek)) : null;

  return (
    <section className={`labcore${active ? " labcore--live" : " labcore--idle"}`} aria-label="Research lab">
      {/* backdrop: an accent glow, the silicon circuit, and data pulses running along its traces */}
      <CircuitMotif className="labcore__circuit" />
      <CircuitMotif className="labcore__circuit labcore__circuit--pulse" />

      <div className="labcore__main">
        <div className="labcore__ring" role="img" aria-label={active ? `${active.name}: ${pct}% complete` : "Lab idle"}>
          <svg viewBox="0 0 120 120" aria-hidden>
            <defs>
              <linearGradient id={`lc-arc-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" className="labcore__stop-a" />
                <stop offset="1" className="labcore__stop-b" />
              </linearGradient>
              <filter id={`lc-glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.6" />
              </filter>
            </defs>
            <g className="labcore__ticks">
              {Array.from({ length: TICKS }, (_, i) => {
                const a = (i / TICKS) * 2 * Math.PI;
                const lit = active && i / TICKS < frac;
                return <line key={i} className={lit ? "labcore__tick--lit" : undefined}
                  x1={60 + 58 * Math.cos(a)} y1={60 + 58 * Math.sin(a)} x2={60 + (i % 3 === 0 ? 54.5 : 56) * Math.cos(a)} y2={60 + (i % 3 === 0 ? 54.5 : 56) * Math.sin(a)} />;
              })}
            </g>
            <circle className="labcore__track" cx="60" cy="60" r={R} />
            {active ? (
              <>
                {/* the glow is a blurred copy of the arc, so it follows the progress exactly */}
                <circle className="labcore__arc labcore__arc--glow" cx="60" cy="60" r={R} stroke={`url(#lc-arc-${uid})`}
                  strokeDasharray={`${C * frac} ${C}`} filter={`url(#lc-glow-${uid})`} transform="rotate(-90 60 60)" style={{ "--arc": C * frac } as CSSProperties} />
                <circle className="labcore__arc" cx="60" cy="60" r={R} stroke={`url(#lc-arc-${uid})`}
                  strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 60 60)" style={{ "--arc": C * frac } as CSSProperties} />
                {frac > 0 && <circle className="labcore__head" cx={head[0]} cy={head[1]} r="4" />}
              </>
            ) : (
              <circle className="labcore__orbit" cx="60" cy="60" r={R} />
            )}
            {/* a scanner mote circling the dial — the lab is awake */}
            <g className="labcore__scan"><circle cx="60" cy={60 - 44} r="1.8" /></g>
          </svg>
          <div className="labcore__ring-core">
            {active
              ? (active.kind === "tier" ? <ComponentIcon kind={active.ref as ComponentKind} size={18} /> : <FlaskConical size={18} aria-hidden />)
              : <FlaskConical size={22} aria-hidden />}
            {active && <strong className="labcore__pct tnum">{pct}<small>%</small></strong>}
          </div>
        </div>

        <div className="labcore__info">
          <span className="labcore__eyebrow">{active ? "In the lab" : "Lab idle"}</span>
          {active ? (
            <>
              <strong className="labcore__name">{active.name}</strong>
              <p className="labcore__blurb">{active.blurb}</p>
              <div className="labcore__chips">
                <span className="labcore__chip"><Clock size={12} aria-hidden /> {left === 0 ? "Finishing" : `${left} wk left`}</span>
                <span className="labcore__chip">{active.rpCost} RP in</span>
              </div>
            </>
          ) : (
            <>
              <strong className="labcore__name">Ready for a breakthrough</strong>
              <p className="labcore__blurb">Research runs one project at a time. Pick what the lab builds next.</p>
            </>
          )}
        </div>
      </div>

      {/* the RP bank feeding the lab, and the next thing worth saving for */}
      <div className="labcore__bank">
        <div className="labcore__rp">
          <span className="labcore__label">Research points</span>
          <strong className="labcore__rp-val tnum"><AnimatedInt value={rp} /><small> RP</small></strong>
          <span className={`labcore__rate${perWeek > 0 ? "" : " labcore__rate--off"}`}>
            <TrendingUp size={12} aria-hidden /> {perWeek > 0 ? `+${perWeek.toFixed(1)}/wk` : "no R&D staff"}
          </span>
        </div>
        {!goal && availableCount > 0 && (
          <div className="labcore__ready">
            <span className="labcore__label">Ready to start</span>
            <strong className="labcore__ready-val tnum">{availableCount}</strong>
            <span className="labcore__goal-meta">{availableCount === 1 ? "project" : "projects"} you can afford</span>
          </div>
        )}
        {goal && (
          <div className="labcore__goal">
            <span className="labcore__label">Saving for</span>
            <span className="labcore__goal-name">{goal.name}</span>
            <span className="labcore__goal-track" role="progressbar" aria-label={`Saving for ${goal.name}`} aria-valuemin={0} aria-valuemax={goal.rpCost} aria-valuenow={Math.min(rp, goal.rpCost)}>
              <i style={{ width: `${Math.round(goalFrac * 100)}%` }} />
            </span>
            <span className="labcore__goal-meta tnum">{rp}/{goal.rpCost}{goalWeeks != null && goalWeeks > 0 ? ` · ~${goalWeeks} wk` : ""}</span>
          </div>
        )}
      </div>

      {/* the queue as a pipeline: one segment per slot, filled slots listed underneath */}
      <div className="labcore__queue">
        <div className="labcore__queue-head">
          <span className="labcore__label">Queue · {queue.length}/{slots}</span>
          <span className="labcore__slots" aria-hidden>
            {Array.from({ length: slots }, (_, i) => <i key={i} className={i < queue.length ? "labcore__slot--on" : undefined} />)}
          </span>
        </div>
        {queue.length > 0 ? (
          <ol className="labcore__queue-list">
            {queue.map((q, i) => (
              <li key={q.ref}>
                <span className="labcore__queue-n tnum">{i + 1}</span>
                <span className="labcore__queue-name">{q.name}</span>
                <span className="labcore__queue-meta tnum">{q.totalWeeks} wk · {q.rpCost} RP</span>
                <button type="button" className="labcore__queue-x" aria-label={`Remove ${q.name} and refund ${q.rpCost} RP`} onClick={() => cancelQueuedResearch(q.ref)}><X size={14} aria-hidden /></button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="labcore__queue-empty">{active ? "Line up the next project and the lab moves straight on." : "Nothing queued yet."}</p>
        )}
      </div>

      {active && (
        <details className="labcore__cancel">
          <summary>Cancel project</summary>
          <p>Refunds all {active.rpCost} RP. Progress is lost; the next queued project starts immediately.</p>
          <Button size="sm" variant="secondary" onClick={() => cancelResearch()}>Cancel and refund {active.rpCost} RP</Button>
        </details>
      )}
    </section>
  );
}
