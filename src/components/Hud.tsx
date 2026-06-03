import { FastForward, FlaskConical, Pause, Play, Settings as SettingsIcon, Star } from "lucide-react";
import { AnimatedInt, AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { eraName } from "../engine/eras.ts";
import { useGame } from "../state/useGame.tsx";
import "./hud.css";

export function weekLabel(week: number): string {
  const year = Math.floor(week / 52) + 1;
  const quarter = Math.floor((week % 52) / 13) + 1;
  return `Y${year} Q${quarter}`;
}

export function Hud({ onSettings }: { onSettings: () => void }) {
  const { state, paused, setPaused, fast, setFast } = useGame();
  return (
    <header className="hud">
      <div className="hud__cash">
        <span className="hud__cash-label">Cash</span>
        <AnimatedMoney value={state.cash} className="hud__cash-value rounded" />
      </div>
      <div className="hud__meta">
        <div className="hud__chip hud__chip--rp" title="Research Points">
          <FlaskConical size={13} strokeWidth={2.2} aria-hidden />
          <AnimatedInt value={Math.floor(state.researchPoints)} />
        </div>
        <div className="hud__chip" title="Reputation">
          <Star size={13} strokeWidth={2.4} fill="currentColor" style={{ color: "var(--warning)" }} aria-hidden />
          <span className="tnum">{Math.round(state.reputation)}</span>
        </div>
        <div className="hud__chip hud__chip--muted" title={`${eraName(state.era)} · ${weekLabel(state.week)}`}>
          <span className="tnum">Wk {state.week}</span>
          <span className="hud__chip-sep">·</span>
          <span className="tnum">{weekLabel(state.week)}</span>
        </div>
        <button
          className="hud__pause"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Resume" : "Pause"}
          aria-pressed={paused}
        >
          {paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
        </button>
        <button
          className={`hud__pause${fast && !paused ? " hud__pause--on" : ""}`}
          onClick={() => { setFast(!fast); if (!fast) setPaused(false); }}
          aria-label={fast ? "Normal speed" : "Fast forward"}
          aria-pressed={fast}
        >
          <FastForward size={14} fill="currentColor" />
        </button>
        <button className="hud__pause" onClick={onSettings} aria-label="Settings">
          <SettingsIcon size={15} />
        </button>
      </div>
    </header>
  );
}
