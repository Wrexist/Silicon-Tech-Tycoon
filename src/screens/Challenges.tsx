// Daily / weekly challenges picker — today's seeded challenges, your best, history, and shareable
// codes. Reuses the scenarios card visual language (scenarios.css). Starting a challenge replaces
// the current company, so it confirms first.
import { useState } from "react";
import { CalendarDays, CalendarRange, Target, Trophy, Share2 } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { showToast } from "../design/toast.tsx";
import { haptic } from "../design/haptics.ts";
import {
  dailyChallenge,
  weeklyChallenge,
  dateKeyOf,
  formatScore,
  scoreMetricLabel,
  encodeChallengeCode,
  decodeChallengeCode,
  type Challenge,
  type ChallengeKind,
} from "../engine/challenges.ts";
import { bestScore, challengeKey, challengeHistory } from "../state/challengeProgress.ts";
import { netWorth } from "../state/gameState.ts";
import { format } from "../engine/money.ts";
import { useGame } from "../state/useGame.tsx";
import "./scenarios.css";

interface Target { kind: ChallengeKind; dateKey: string; }

function shareCode(kind: ChallengeKind, dateKey: string): void {
  const code = encodeChallengeCode(kind, dateKey);
  const done = () => showToast(`Code copied — ${code}`, { tone: "positive", glyph: <Share2 size={15} /> });
  try {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done).catch(done);
    else done();
  } catch {
    done();
  }
}

function ChallengeCard({ challenge, onPlay }: { challenge: Challenge; onPlay: () => void }) {
  const isWeekly = challenge.kind === "weekly";
  const best = bestScore(challengeKey(challenge.kind, challenge.dateKey));
  return (
    <li className="scn__card scn__card--played">
      <div className="scn__card-top">
        <span className={`scn__diff ${isWeekly ? "scn__diff--expert" : "scn__diff--standard"}`}>
          {isWeekly ? <CalendarRange size={12} /> : <CalendarDays size={12} />} {isWeekly ? "Weekly" : "Daily"}
        </span>
        {best != null && (
          <span className="scn__best tnum"><Trophy size={13} /> {formatScore(challenge.scoreMetric, best)}</span>
        )}
      </div>
      <h3 className="scn__name">{isWeekly ? "Weekly Challenge" : "Daily Challenge"}</h3>
      <p className="scn__tagline">Highest {scoreMetricLabel(challenge.scoreMetric)} by week {challenge.scoreWeek}</p>

      <ul className="scn__tiers">
        {challenge.mutators.map((m) => (
          <li key={m.id} className="scn__tier scn__tier--met">
            <Target size={12} />
            <span className="scn__tier-objs"><strong>{m.name}</strong> — {m.description}</span>
          </li>
        ))}
      </ul>

      <div className="scn__card-actions">
        <Button size="sm" onClick={onPlay}>
          <Target size={15} /> {best != null ? "Beat your best" : "Play"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => { haptic.light(); shareCode(challenge.kind, challenge.dateKey); }}>
          <Share2 size={15} /> Share
        </Button>
      </div>
    </li>
  );
}

export function ChallengesSheet({ onClose }: { onClose: () => void }) {
  const { state, startChallenge } = useGame();
  const [confirm, setConfirm] = useState<Target | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const today = dateKeyOf(new Date());
  const daily = dailyChallenge(today);
  const weekly = weeklyChallenge(today);
  const history = challengeHistory();

  const begin = (t: Target) => {
    startChallenge(t.kind, t.dateKey);
    onClose();
  };

  const playFromCode = () => {
    const decoded = decodeChallengeCode(code);
    if (!decoded) { setCodeError(true); return; }
    setCodeError(false);
    setConfirm(decoded);
  };

  return (
    <div className="scn">
      <div className="scn__head">
        <div>
          <h2 className="scn__title">Challenges</h2>
          <p className="scn__sub">A fresh, seeded challenge every day. One run — beat your own best, or share a code.</p>
        </div>
      </div>

      <ul className="scn__list">
        <ChallengeCard challenge={daily} onPlay={() => setConfirm({ kind: "daily", dateKey: today })} />
        <ChallengeCard challenge={weekly} onPlay={() => setConfirm({ kind: "weekly", dateKey: weekly.dateKey })} />
      </ul>

      <div className="scn__code">
        <label className="scn__code-label" htmlFor="scn-code">Play a shared code</label>
        <div className="scn__code-row">
          <input
            id="scn-code"
            className={`scn__code-input${codeError ? " scn__code-input--err" : ""}`}
            value={code}
            placeholder="ST-D-20260619"
            aria-label="Challenge code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => { setCode(e.target.value); setCodeError(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") playFromCode(); }}
          />
          <Button size="sm" variant="secondary" disabled={!code.trim()} onClick={playFromCode}>Play</Button>
        </div>
        {codeError && <p className="scn__code-err">That code isn't valid. Codes look like ST-D-20260619.</p>}
      </div>

      {history.length > 0 && (
        <>
          <p className="scn__hist-head">Your history <span className="tnum">· {history.length}</span></p>
          <ul className="scn__hist">
            {history.slice(0, 30).map((h) => {
              const ch = h.kind === "weekly" ? weeklyChallenge(h.dateKey) : dailyChallenge(h.dateKey);
              return (
                <li key={`${h.kind}:${h.dateKey}`} className="scn__hist-row">
                  <span className="scn__hist-kind">{h.kind === "weekly" ? <CalendarRange size={13} /> : <CalendarDays size={13} />}</span>
                  <span className="scn__hist-date">{h.dateKey}</span>
                  <span className="scn__hist-goal">{scoreMetricLabel(ch.scoreMetric)}</span>
                  <span className="scn__hist-score tnum">{formatScore(ch.scoreMetric, h.score)}</span>
                  <button className="scn__hist-share" aria-label={`Share ${h.dateKey} ${h.kind} challenge`} onClick={() => { haptic.light(); shareCode(h.kind, h.dateKey); }}>
                    <Share2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Button block variant="secondary" onClick={onClose}>Done</Button>

      {confirm && (
        <div className="scn__confirm" role="dialog" aria-modal="true" aria-label="Confirm starting challenge">
          <div className="scn__confirm-card">
            <p className="scn__confirm-title">Start this {confirm.kind} challenge?</p>
            <p className="scn__confirm-text">
              This replaces <strong>{state.companyName}</strong> (Wk {state.week} · {format(netWorth(state))} net worth).
              Your best scores and museum are kept.
            </p>
            <div className="scn__confirm-row">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button onClick={() => begin(confirm)}>Start</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
