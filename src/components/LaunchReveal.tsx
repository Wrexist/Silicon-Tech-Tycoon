// The launch "reveal" — a keynote-style moment when a product ships: the device on stage, the
// critic reviews counting in, then the verdict + projected sales, with confetti on a hit. Mounted
// once in App; driven by the launchReveal module bus. Reduced-motion jumps straight to the result.
import { useEffect, useRef, useState } from "react";
import { Rocket, Sparkles, Star, X } from "lucide-react";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { Button } from "../design/primitives.tsx";
import { onLaunchReveal, type LaunchRevealData } from "../design/launchReveal.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { prefersReducedMotion } from "../garage3d/support.ts";
import "./launchReveal.css";

type Stage = "intro" | "reviews" | "verdict";

const VERDICT_COPY: Record<LaunchRevealData["verdict"], { label: string; tone: string }> = {
  hit: { label: "It's a hit!", tone: "hit" },
  solid: { label: "Solid performer", tone: "solid" },
  steady: { label: "Steady seller", tone: "steady" },
  flop: { label: "Slow start", tone: "flop" },
};

export function LaunchReveal() {
  const [data, setData] = useState<LaunchRevealData | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [score, setScore] = useState(0);
  const [units, setUnits] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  if (!data) return null;
  const v = VERDICT_COPY[data.verdict];
  const close = () => { timers.current.forEach(clearTimeout); setData(null); };

  return (
    <div className={`lreveal lreveal--${v.tone}`} role="dialog" aria-modal="true" aria-label={`Launch results for ${data.product.name}`}>
      <button className="lreveal__scrim" aria-label="Dismiss" onClick={close} />
      <div className="lreveal__card">
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
            <div className="lreveal__units">
              <span className="lreveal__units-val tnum">{units.toLocaleString()}</span>
              <span className="lreveal__units-label">units projected to sell</span>
            </div>
            <Button block onClick={close}>Continue</Button>
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
