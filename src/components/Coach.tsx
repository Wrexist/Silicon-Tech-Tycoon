import type { CSSProperties } from "react";
import { ArrowRight, Hammer, PencilRuler, Rocket, Sparkles, X, type LucideIcon } from "lucide-react";
import { useGame } from "../state/useGame.tsx";
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
      {!step.done && (
        <button className="coach__skip" aria-label="Skip tutorial" onClick={dismissTutorial}><X size={15} /></button>
      )}
      <div className="coach__glyph"><step.icon size={18} /></div>
      <div className="coach__body">
        <div className="coach__title">{step.title}</div>
        <div className="coach__text">{step.text}</div>
        {step.done ? (
          <div className="coach__actions">
            <button className="coach__cta" onClick={dismissTutorial}>Got it</button>
          </div>
        ) : step.cta ? (
          <div className="coach__actions">
            <button className="coach__cta" onClick={() => onNavigate(step.cta!.tab)}>
              {step.cta.label} <ArrowRight size={14} />
            </button>
          </div>
        ) : null}
      </div>
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
      title: "Built — time to launch",
      text: "On the Office tab, tap Launch on your finished device. The campaign you picked when planning production kicks in now — timing matters, so launch while demand is hot.",
      cta: tab === "hq" ? undefined : { label: "Go to Office", tab: "hq" },
    };
  }
  if (state.building.length > 0) {
    return {
      id: "building",
      color: engOrange,
      icon: Hammer,
      title: "Manufacturing started",
      text: "Time advances automatically as it builds — tap the Fast-forward button in the top bar to speed through the wait, or Pause to hold. Watch the progress on the Office tab; you'll launch once it's ready.",
      cta: tab === "hq" ? undefined : { label: "Go to Office", tab: "hq" },
    };
  }
  return {
    id: "design",
    color: designGreen,
    icon: PencilRuler,
    title: "Design your first device",
    text: "Work left to right through the tabs up top — Components, Style, Camera, then Launch — to pick parts, a finish, and a price. Then tap Plan production to set a run size and campaign; you pay for the whole run upfront, so keep a cash cushion.",
    cta: tab === "design" ? undefined : { label: "Open Design Lab", tab: "design" },
  };
}
