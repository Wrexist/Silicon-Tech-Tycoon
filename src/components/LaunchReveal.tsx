// The launch "reveal" — a keynote-style moment when a product ships: the device on stage, the
// critic reviews counting in, then the verdict + projected sales, with confetti on a hit. Mounted
// once in App; driven by the launchReveal module bus. Reduced-motion jumps straight to the result.
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Flame, Rocket, Sparkles, Star, X } from "lucide-react";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { onLaunchReveal, type LaunchRevealData } from "../design/launchReveal.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { emitHqReaction } from "../design/hqReaction.ts";
import { prefersReducedMotion } from "../garage3d/support.ts";
import "./launchReveal.css";

type Stage = "intro" | "reviews" | "verdict";

const VERDICT_COPY: Record<LaunchRevealData["verdict"], { label: string; tone: string }> = {
  hit: { label: "It's a hit!", tone: "hit" },
  solid: { label: "Solid performer", tone: "solid" },
  steady: { label: "Steady seller", tone: "steady" },
  flop: { label: "Slow start", tone: "flop" },
};

export function LaunchReveal({ onSeeBreakdown }: { onSeeBreakdown?: (productId: string) => void } = {}) {
  const [data, setData] = useState<LaunchRevealData | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [score, setScore] = useState(0);
  const [units, setUnits] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => onLaunchReveal((d) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setData(d);
    setScore(0);
    setUnits(0);
    if (prefersReducedMotion()) {
      // No animation: show the full result at once.
      setStage("verdict");
      setScore(d.aggregate);
      setUnits(d.units);
      if (d.isHit || d.firstLaunch) emitCelebrate();
      return;
    }
    setStage("intro");
    const t = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    // intro → reviews (count the aggregate up) → verdict (count units, fire confetti on a hit)
    t(900, () => { setStage("reviews"); countTo(d.aggregate, setScore, timers); });
    t(2300, () => {
      setStage("verdict");
      countTo(d.units, setUnits, timers, 900);
      if (d.isHit || d.firstLaunch) emitCelebrate();
    });
  }), []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const close = () => {
    if (!data) return;
    timers.current.forEach(clearTimeout);
    // The office reacts as you return to it: cheer on a win/debut, a brief slump on a flop.
    if (data.isHit || data.firstLaunch || data.verdict === "solid") emitHqReaction("cheer");
    else if (data.verdict === "flop") emitHqReaction("slump");
    setData(null);
  };

  // a11y: this is a hand-built modal shown on EVERY launch, so it must carry the same focus/keyboard
  // machinery as the shared Sheet — trap Tab focus within the card while open, and close on Escape.
  useDialogFocus(dialogRef, data !== null);
  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close is derived from `data`; re-binding when `data` changes is sufficient and correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return null;
  const v = VERDICT_COPY[data.verdict];

  return (
    <div className={`lreveal lreveal--${v.tone}`}>
      {/* Scrim sits OUTSIDE the focus trap (the dialog is the card below), so keyboard focus lands on
          the dialog controls, not the invisible backdrop button. */}
      <button className="lreveal__scrim" aria-label="Dismiss" onClick={close} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="lreveal__card"
        role="dialog"
        aria-modal="true"
        aria-label={`Launch results for ${data.product.name}`}
      >
        <button className="lreveal__close" onClick={close} aria-label="Close"><X size={18} /></button>

        <div className="lreveal__stage">
          <span className="lreveal__glow" aria-hidden />
          <DeviceRenderer product={data.product} size={150} idle shimmer />
        </div>

        {data.firstLaunch && <div className="lreveal__first"><Sparkles size={13} aria-hidden /> Your first product is live!</div>}
        <div className="lreveal__eyebrow"><Rocket size={13} aria-hidden /> {data.product.name} · launched</div>

        {/* Critic aggregate — counts in once reviews land */}
        <div className={`lreveal__score${stage === "intro" ? " lreveal__score--pending" : ""}`}>
          <span className="lreveal__score-label">Critics' score</span>
          <span className="lreveal__score-val tnum">{stage === "intro" ? "…" : score}</span>
          <span className="lreveal__score-den">/ 100</span>
        </div>

        {stage !== "intro" && (
          <div className="lreveal__outlets">
            {data.outlets.map((o) => (
              <span key={o.outlet} className="lreveal__outlet">
                <span className="lreveal__outlet-name">{o.outlet}</span>
                <span className="lreveal__outlet-score tnum"><Star size={10} fill="currentColor" aria-hidden /> {o.score}</span>
              </span>
            ))}
          </div>
        )}

        {stage !== "intro" && <p className="lreveal__quote">"{data.headline}"</p>}

        {stage === "verdict" && (
          <>
            <div className={`lreveal__verdict lreveal__verdict--${v.tone}`}>{v.label}</div>
            {data.streak >= 2 && (
              <div className="lreveal__streak">
                <Flame size={14} aria-hidden />
                {data.streak >= 4 ? `${data.streak} in a row · unstoppable` : data.streak === 3 ? "3 in a row · on fire" : "2 hits in a row"}
              </div>
            )}
            <div className="lreveal__units">
              <span className="lreveal__units-val tnum">{units.toLocaleString()}</span>
              <span className="lreveal__units-label">units projected to sell</span>
            </div>
            {/* The outcome's WHY, at the moment it lands — the post-mortem's #1 ranked driver
                (pillar #5). The full breakdown lives in the Market detail; deep-link it. */}
            {data.why && (
              <div className="lreveal__why">
                <span className="lreveal__why-label">Biggest factor</span>
                <span className="lreveal__why-text">{data.why}</span>
              </div>
            )}
            <Button block onClick={close}>Continue</Button>
            {onSeeBreakdown && (
              <button
                className="lreveal__breakdown"
                onClick={() => {
                  const id = data.product.id;
                  close();
                  onSeeBreakdown(id);
                }}
              >
                See the full breakdown <ChevronRight size={14} aria-hidden />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Ease a counter from its current value to `target` over ~ms, pushing timers for cleanup. */
function countTo(
  target: number,
  set: (n: number) => void,
  timers: React.MutableRefObject<ReturnType<typeof setTimeout>[]>,
  ms = 700,
) {
  const steps = 18;
  for (let i = 1; i <= steps; i++) {
    timers.current.push(setTimeout(() => {
      // ease-out
      const p = i / steps;
      const eased = 1 - Math.pow(1 - p, 3);
      set(Math.round(target * eased));
    }, (ms / steps) * i));
  }
}
