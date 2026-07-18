// Daily / weekly challenges picker — today's seeded challenges, your best, history, and shareable
// codes. Reuses the scenarios card visual language (scenarios.css). Starting a challenge parks the
// player's freeform company (stashed, restorable via the tracker's "return to your company"), so it
// confirms first but never destroys the company.
import { useRef, useState } from "react";
import { CalendarDays, CalendarRange, Target, Trophy, Share2, Sparkles, Lock, Check, Palette, Grid2x2, Square, Award } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { showToast } from "../design/toast.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
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
import {
  currentSeasonId,
  seasonLabel,
  seasonRewards,
  seasonCount,
  getSeasons,
  SEASON_RUNGS,
  type SeasonRewardType,
} from "../state/seasons.ts";
import { netWorth } from "../state/gameState.ts";
import { format } from "../engine/money.ts";
import { useGame } from "../state/useGame.tsx";
import "./scenarios.css";

interface Target { kind: ChallengeKind; dateKey: string; }

function shareCode(kind: ChallengeKind, dateKey: string): void {
  const code = encodeChallengeCode(kind, dateKey);
  const onCopied = () => showToast(`Code copied, ${code}`, { tone: "positive", glyph: <Share2 size={15} /> });
  // Clipboard unavailable or denied → surface the code so the player can copy it manually.
  const onFallback = () => showToast(`Share code: ${code}`, { tone: "neutral", glyph: <Share2 size={15} /> });
  try {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(onCopied).catch(onFallback);
    else onFallback();
  } catch {
    onFallback();
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
            <span className="scn__tier-objs"><strong>{m.name}</strong> · {m.description}</span>
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

const REWARD_ICON: Record<SeasonRewardType, typeof Palette> = {
  colorway: Palette,
  floor: Grid2x2,
  wall: Square,
  badge: Award,
};
const REWARD_KIND: Record<SeasonRewardType, string> = {
  colorway: "Device colourway",
  floor: "HQ floor",
  wall: "HQ walls",
  badge: "Profile badge",
};

/** The seasonal cosmetic reward track — this calendar month's rungs, what each unlocks (previewed
 *  even when locked), and how many completions you've banked. Pure read of the profile store. */
function SeasonTrack() {
  const seasonId = currentSeasonId();
  const store = getSeasons();
  const count = seasonCount(seasonId, store);
  const rewards = seasonRewards(seasonId);
  const top = SEASON_RUNGS[SEASON_RUNGS.length - 1];
  const nextRung = SEASON_RUNGS.find((r) => count < r);
  return (
    <section className="season" aria-label="Challenge season reward track">
      <div className="season__head">
        <span className="season__glyph" aria-hidden><Sparkles size={16} /></span>
        <div className="season__head-info">
          <h3 className="season__title">Season: {seasonLabel(seasonId)}</h3>
          <p className="season__sub">Complete daily &amp; weekly challenges to earn cosmetic rewards.</p>
        </div>
        <span className="season__count tnum">{count}<span className="season__count-total">/{top}</span></span>
      </div>
      <ul className="season__rungs">
        {rewards.map((r) => {
          const unlocked = count >= r.rung;
          const Icon = REWARD_ICON[r.type];
          return (
            <li key={r.cosmeticId} className={`season__rung${unlocked ? " season__rung--on" : ""}`}>
              <span className="season__rung-req tnum" aria-hidden>{r.rung}</span>
              <span className="season__rung-icon" aria-hidden><Icon size={15} /></span>
              <span className="season__rung-info">
                <span className="season__rung-name">{r.name}</span>
                <span className="season__rung-kind">{REWARD_KIND[r.type]}</span>
              </span>
              <span className="season__rung-state" aria-hidden>
                {unlocked ? <Check size={15} /> : <Lock size={13} />}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="season__foot">
        {nextRung != null
          ? `${nextRung - count} more to the next reward.`
          : "Every reward this season is yours. New rewards next month."}
      </p>
    </section>
  );
}

export function ChallengesSheet({ onClose }: { onClose: () => void }) {
  const { state, startChallenge } = useGame();
  const [confirm, setConfirm] = useState<Target | null>(null);
  // Trap Tab inside the confirm card and restore focus to the opener on close (parity with the shared
  // Sheet dialogs) — this "replace your run" confirm must not leak focus to the buttons behind it.
  const confirmRef = useRef<HTMLDivElement>(null);
  useDialogFocus(confirmRef, confirm !== null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const today = dateKeyOf(new Date());
  const daily = dailyChallenge(today);
  const weekly = weeklyChallenge(today);
  const history = challengeHistory();

  const begin = (t: Target) => {
    startChallenge(t.kind, t.dateKey);
    haptic.success();
    sfx("confirm");
    showToast(`${t.kind === "daily" ? "Daily" : "Weekly"} challenge started — good luck`, { tone: "positive" });
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
          <p className="scn__sub">A fresh, seeded challenge every day. One run, beat your own best, or share a code.</p>
        </div>
      </div>

      <SeasonTrack />

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
        <div className="scn__confirm" role="dialog" aria-modal="true" aria-label="Confirm starting challenge"
          onClick={() => setConfirm(null)}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setConfirm(null); } }}>
          <div ref={confirmRef} tabIndex={-1} className="scn__confirm-card" onClick={(e) => e.stopPropagation()}>
            <p className="scn__confirm-title">Start this {confirm.kind} challenge?</p>
            {state.activeChallenge || state.activeScenario ? (
              <p className="scn__confirm-text">
                This starts a fresh {confirm.kind} run in place of the current one. Your parked company is untouched — you'll
                still return to it. Best scores and museum are kept.
              </p>
            ) : (
              <p className="scn__confirm-text">
                <strong>{state.companyName}</strong> (Wk {state.week} · {format(netWorth(state))} net worth) is kept safe — return
                to it any time from the challenge tracker. Your best scores and museum are kept.
              </p>
            )}
            <div className="scn__confirm-row">
              <Button variant="secondary" autoFocus onClick={() => setConfirm(null)}>Cancel</Button>
              <Button haptics="none" onClick={() => begin(confirm)}>Start</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
