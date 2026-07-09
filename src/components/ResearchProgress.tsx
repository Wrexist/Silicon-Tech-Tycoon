// Immersive research readout — the active research develops inside a circular progress ring (the same
// "halo" concept as the manufacturing BuildProgress), with a live stage label — Hypothesis →
// Prototyping → Testing → Refining → Finalizing — so the wait reads as a real process, not a silent
// bar. Pure presentational; driven by the ActiveResearch's startWeek / totalWeeks. Sub-week smoothed.
import { useEffect, useState } from "react";
import { FlaskConical, Lightbulb, ScanLine, Sparkles, CheckCircle2, X, type LucideIcon } from "lucide-react";
import { BALANCE } from "../engine/balance.ts";
import { useGame } from "../state/useGame.tsx";
import type { ActiveResearch } from "../state/gameState.ts";
import "./researchProgress.css";

const RING_R = 33;
const RING_C = 2 * Math.PI * RING_R;

interface Stage { at: number; label: string; short: string; sub: string; icon: LucideIcon }
const STAGES: readonly Stage[] = [
  { at: 0, label: "Hypothesis", short: "Idea", sub: "framing the idea", icon: Lightbulb },
  { at: 0.24, label: "Prototyping", short: "Proto", sub: "building the first pass", icon: FlaskConical },
  { at: 0.5, label: "Testing", short: "Test", sub: "measuring what works", icon: ScanLine },
  { at: 0.76, label: "Refining", short: "Refine", sub: "tightening the design", icon: Sparkles },
  { at: 0.94, label: "Finalizing", short: "Ship", sub: "writing it up", icon: CheckCircle2 },
];
function stageFor(frac: number): { stage: Stage; index: number } {
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (frac >= STAGES[i].at) index = i;
  return { stage: STAGES[index], index };
}

/** Sub-week smoothing so the ring counts up continuously (not 0→33→67% jumps), capped just short of
 *  the next week so the sim's own tick always lands ahead. Mirrors BuildProgress's useSmoothWeeks. */
function useSmoothWeeks(elapsed: number, totalWeeks: number): number {
  const { paused, fast, skipping } = useGame();
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [est, setEst] = useState({ week: elapsed, sub: 0 });
  const sub = est.week === elapsed ? est.sub : 0;
  useEffect(() => {
    if (paused || reduced || elapsed >= totalWeeks) return;
    const sub0 = sub;
    if (sub0 >= 0.97) return;
    const tickMs = (BALANCE.secondsPerTick / (fast || skipping ? BALANCE.fastMultiplier : 1)) * 1000;
    let t0 = performance.now();
    let lastNow = t0;
    const id = setInterval(() => {
      const now = performance.now();
      if (document.hidden) { t0 += now - lastNow; lastNow = now; return; }
      lastNow = now;
      const nextSub = Math.min(0.97, sub0 + (now - t0) / tickMs);
      setEst((prev) => (prev.week === elapsed && prev.sub === nextSub ? prev : { week: elapsed, sub: nextSub }));
    }, 120);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, fast, skipping, reduced, elapsed, totalWeeks]);
  return Math.min(totalWeeks, elapsed + (reduced ? 0 : sub));
}

export function ResearchProgress({ research }: { research: ActiveResearch }) {
  const { state, cancelResearch, cancelQueuedResearch } = useGame();
  const queue = state.researchQueue ?? [];
  const elapsed = Math.max(0, state.week - research.startWeek);
  const smoothWeeks = useSmoothWeeks(elapsed, research.totalWeeks);
  const frac = Math.max(0, Math.min(1, smoothWeeks / Math.max(1e-6, research.totalWeeks)));
  const pct = Math.round(frac * 100);
  const weeksLeft = Math.max(0, Math.ceil(research.totalWeeks - elapsed));
  const { stage, index: activeIdx } = stageFor(frac);
  const StageIcon = stage.icon;
  const nearDone = frac >= 0.9;
  const offset = RING_C * (1 - frac);

  return (
    <div className={`rprog${nearDone ? " rprog--near" : ""}`}>
      <div className="rprog__top">
        <div className="rprog__ring">
          <span className="rprog__halo" aria-hidden />
          <span className="rprog__sweep" aria-hidden />
          <svg className="rprog__svg" viewBox="0 0 80 80" aria-hidden>
            <circle className="rprog__track" cx="40" cy="40" r={RING_R} />
            <circle className="rprog__fill" cx="40" cy="40" r={RING_R} style={{ strokeDasharray: RING_C, strokeDashoffset: offset }} />
          </svg>
          <span className="rprog__glyph" aria-hidden><FlaskConical size={30} /></span>
          <span className="rprog__pct tnum" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${research.name} research progress`}>
            {pct}<span className="rprog__pct-sign">%</span>
          </span>
        </div>

        <div className="rprog__body">
          <span className="rprog__eyebrow">In the lab</span>
          <span className="rprog__name">{research.name}</span>
          <span className="rprog__stage" key={stage.label}>
            <span className="rprog__stage-icon"><StageIcon size={14} aria-hidden /></span>
            <span className="rprog__stage-text">
              <b>{stage.label}</b>
              <small>{stage.sub}</small>
            </span>
          </span>
          <span className="rprog__meta tnum">
            {weeksLeft > 0 ? `${weeksLeft} wk left` : "Finishing up"}
            <span className="rprog__cost"> · {research.rpCost} RP</span>
          </span>
        </div>

        <button className="rprog__cancel" onClick={() => cancelResearch()} aria-label="Cancel research and refund RP" title="Cancel — refunds the RP">
          <X size={16} />
        </button>
      </div>

      <ol className="rprog__trail" aria-label="Research stages">
        {STAGES.map((s, i) => {
          const st = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
          const Icon = s.icon;
          return (
            <li key={s.label} className={`rprog__step rprog__step--${st}`} aria-current={st === "active" ? "step" : undefined}>
              <span className="rprog__row">
                <span className="rprog__node"><Icon size={11} aria-hidden /></span>
                {i < STAGES.length - 1 && <span className={`rprog__bar${i < activeIdx ? " rprog__bar--done" : ""}`} aria-hidden />}
              </span>
              <span className="rprog__cap">{s.short}</span>
            </li>
          );
        })}
      </ol>

      {queue.length > 0 && (
        <div className="rprog__queue">
          <span className="rprog__queue-label">Up next · {queue.length}</span>
          <ul className="rprog__queue-list">
            {queue.map((q, i) => (
              <li key={q.ref} className="rprog__queue-item">
                <span className="rprog__queue-n tnum">{i + 1}</span>
                <span className="rprog__queue-name">{q.name}</span>
                <span className="rprog__queue-weeks tnum">{q.totalWeeks} wk</span>
                <button className="rprog__queue-x" onClick={() => cancelQueuedResearch(q.ref)} aria-label={`Remove ${q.name} from the queue`} title="Remove — refunds the RP">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
