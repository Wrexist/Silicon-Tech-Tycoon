import { inboxPendingKey, INBOX_LABEL, higherPriorityPending } from "../design/interruptPriority.ts";
import { openDecision, useDecisionOpen } from "../design/decisionInbox.ts";
import { Calendar, FastForward, FlaskConical, Pause, Play, Settings as SettingsIcon, SkipForward, Star, Trophy } from "lucide-react";
import { AnimatedInt, AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { format } from "../engine/money.ts";
import { eraName } from "../engine/eras.ts";
import { runwayWeeks } from "../engine/economy.ts";
import { weeklyOutflow, nextWeekRevenue } from "../state/gameState.ts";
import { useGame, useGameActions, useGameControls } from "../state/useGame.tsx";
import "./hud.css";

function weekLabel(week: number): string {
  const year = Math.floor(week / 52) + 1;
  const quarter = Math.floor((week % 52) / 13) + 1;
  return `Y${year} Q${quarter}`;
}

export function Hud({ onSettings, onOpenBank, onOpenProgress, progressAttention }: { onSettings: () => void; onOpenBank: () => void; onOpenProgress?: () => void; progressAttention?: boolean }) {
  const { state } = useGame();
  // Critical-runway signal: the HQ/Company runway pills live below the fold, so when cash will
  // run out within a month the always-visible headline number itself turns negative. Same math
  // as the HQ pill (burn vs next week's revenue); sandbox's cash floor never gets here.
  const runway = runwayWeeks(state.cash, weeklyOutflow(state), nextWeekRevenue(state));
  const critical = runway < 4;
  return (
    <header className="hud">
      {/* Row 1: the headline number and the buttons share one line — they are the two things that
          are always tapped, and stacking them was what made this bar tall enough to eat the top of
          the board. Row 2 carries the read-only chips. */}
      <div className="hud__top">
        <button
          type="button"
          className="hud__cash"
          onClick={onOpenBank}
          aria-label={`Open Bank. Cash ${format(state.cash)}${critical ? `, ${runway} weeks of runway left` : ""}`}
        >
          <span className="hud__cash-text">
            <span className={`hud__cash-label${critical ? " hud__cash-label--danger" : ""}`} aria-hidden>
              {critical ? `Cash · ${runway} wk left` : "Cash"}
            </span>
            <AnimatedMoney value={state.cash} className={`hud__cash-value rounded${critical ? " hud__cash-value--danger" : ""}`} />
          </span>
        </button>
        <div className="hud__controls">
          {onOpenProgress && (
            <button
              className={`hud__pause${progressAttention ? " hud__pause--attn" : ""}`}
              onClick={onOpenProgress}
              aria-label={progressAttention ? "Progress — something new to see" : "Progress, achievements and challenges"}
            >
              <Trophy size={15} />
            </button>
          )}
          <button className="hud__pause" onClick={onSettings} aria-label="Settings">
            <SettingsIcon size={15} />
          </button>
        </div>
      </div>

      {/* Row 2: read-only state. One line on every phone width — these used to wrap mid-group and
          push the whole bar taller for the sake of three short pills. */}
      <div className="hud__chips">
        <div
          className="hud__chip hud__chip--rp"
          title="Research Points"
          aria-label={`Research points: ${Math.floor(state.researchPoints)}`}
        >
          <FlaskConical size={13} strokeWidth={2.2} aria-hidden />
          <span className="hud__chip-tag" aria-hidden>RP</span>
          <span aria-hidden>
            <AnimatedInt value={Math.floor(state.researchPoints)} />
          </span>
        </div>
        <div
          className="hud__chip"
          title="Reputation"
          aria-label={`Reputation ${Math.round(state.reputation)} of 100`}
        >
          <Star size={13} strokeWidth={2.4} fill="currentColor" style={{ color: "var(--warning)" }} aria-hidden />
          <span className="hud__chip-tag" aria-hidden>Rep</span>
          <span className="tnum" aria-hidden>{Math.round(state.reputation)}</span>
        </div>
        <div
          className="hud__chip hud__chip--muted"
          title={`${eraName(state.era)} · ${weekLabel(state.week)}`}
          aria-label={`Week ${state.week}`}
        >
          <Calendar size={13} strokeWidth={2.2} aria-hidden />
          <span className="tnum" aria-hidden>Wk {state.week}</span>
          <span className="hud__chip-sep" aria-hidden>·</span>
          <span className="tnum" aria-hidden>{weekLabel(state.week)}</span>
        </div>
      </div>
    </header>
  );
}

/** Continuous simulation controls: one tap pauses, no independent turn-advance path. */
export function SpeedDial() {
  const { paused, fast, skipping, suspended, tabBlocked } = useGameControls();
  const { setPaused, setFast, setSkipping } = useGameActions();
  const held = suspended || tabBlocked;
  const { state } = useGame();
  const decisionOpen = useDecisionOpen();
  const pending = inboxPendingKey(state);
  const reason = tabBlocked ? "Another tab is running this company." : pending ? `Decision waiting: ${INBOX_LABEL[pending]?.title ?? "Review the current decision"}` : "Close the current dialog to continue time.";
  return (
    <div className="time-controls-wrap">
    {held && <div className="time-controls__reason" role="status">{reason}{!tabBlocked && pending && !higherPriorityPending(state, pending) && !decisionOpen && <button onClick={openDecision}>Review decision</button>}</div>}
    <div className="time-controls" role="group" aria-label="Simulation speed">
      <button className="time-controls__play" disabled={held} aria-label={paused ? "Resume" : "Pause"}
        onClick={() => { setSkipping(false); setPaused(!paused); }}>
        {paused || held ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
        <span>{held ? "Waiting" : paused ? "Paused" : skipping ? "Skipping..." : "Running"}</span>
      </button>
      <button className="time-controls__speed" disabled={held} aria-label={fast ? "Normal speed" : "Fast forward"} aria-pressed={fast}
        onClick={() => { setFast(!fast); }}><FastForward size={16} /><span>{fast ? "Fast" : "Normal"}</span></button>
      <button className="time-controls__skip" disabled={held} aria-label={skipping ? "Stop skipping" : "Skip to next event"} aria-pressed={skipping}
        onClick={() => { setSkipping(!skipping); setPaused(skipping); }}>
        <SkipForward size={16} /><span>{skipping ? "Stop" : "Next event"}</span>
      </button>
    </div></div>
  );
}
