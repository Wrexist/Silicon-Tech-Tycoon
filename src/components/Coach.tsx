import type { CSSProperties } from "react";
import { ArrowRight, Hammer, PencilRuler, Rocket, Sparkles, X, type LucideIcon } from "lucide-react";
import { useGame } from "../state/useGame.tsx";
import { haptic } from "../design/haptics.ts";
import type { Tab } from "./BottomNav.tsx";
import "./coach.css";

interface Step {
  id: string;
  color: string;
  icon: LucideIcon;
  title: string;
  text: string;
  cta?: { label: string; tab: Tab };
  done?: boolean; // final step — primary button finishes the tutorial
}

/** Progress-driven first-build coach. Reads game state to decide the current step, so it
 *  survives re-renders and never anchors to fragile DOM nodes. Disappears once the player
 *  launches their first product (or skips). */
export function Coach({ tab, onNavigate }: { tab: Tab; onNavigate: (t: Tab) => void }) {
  const { state, dismissTutorial } = useGame();
  if (state.tutorialDone || state.bankrupt) return null;

  const step = currentStep(state, tab);
  if (!step) return null;

  return (
    <div className="coach" role="status" aria-live="polite" style={{ "--coach-accent": step.color } as CSSProperties}>
      <div className="coach__glyph"><step.icon size={18} /></div>
      <div className="coach__body">
        <div className="coach__title">{step.title}</div>
        <div className="coach__text">{step.text}</div>
      </div>
      {step.done ? (
        <button className="coach__cta" onClick={() => { haptic.success(); dismissTutorial(); }}>Got it</button>
      ) : step.cta ? (
        <button className="coach__cta" onClick={() => { haptic.light(); onNavigate(step.cta!.tab); }}>
          {step.cta.label} <ArrowRight size={14} />
        </button>
      ) : null}
      {!step.done && (
        <button className="coach__skip" aria-label="Skip tutorial" onClick={() => { haptic.light(); dismissTutorial(); }}><X size={15} /></button>
      )}
    </div>
  );
}

function currentStep(state: ReturnType<typeof useGame>["state"], tab: Tab): Step | null {
  const designGreen = "var(--fn-design)";
  const engOrange = "var(--fn-eng)";
  const mktBlue = "var(--fn-mkt)";

  if (state.launched.length > 0) {
    return {
      id: "launched",
      color: "var(--accent)",
      icon: Sparkles,
      title: "Your first product is live",
      text: "Revenue arrives every week as it sells. Reinvest in R&D, hire a team, and design the next one.",
      done: true,
    };
  }
  if (state.ready.length > 0) {
    return {
      id: "ready",
      color: mktBlue,
      icon: Rocket,
      title: "Built — ready to launch",
      text: "Your device is manufactured and waiting. Tap the Launch button on HQ to release it to the market.",
      cta: tab === "hq" ? undefined : { label: "Go to HQ", tab: "hq" },
    };
  }
  if (state.building.length > 0) {
    return {
      id: "building",
      color: engOrange,
      icon: Hammer,
      title: "Manufacturing started",
      text: "Time advances automatically — watch the build progress on HQ. You'll launch once it's ready.",
      cta: tab === "hq" ? undefined : { label: "Go to HQ", tab: "hq" },
    };
  }
  return {
    id: "design",
    color: designGreen,
    icon: PencilRuler,
    title: "Design your first device",
    text: "Pick components, a finish, and a price — then tap Build to start manufacturing.",
    cta: tab === "design" ? undefined : { label: "Open Design Lab", tab: "design" },
  };
}
