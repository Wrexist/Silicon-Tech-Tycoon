// Shareable result card — the only "community surface" available without a backend (per
// RETENTION_ROADMAP Wave 1b). A premium, screenshot-worthy summary of a run/milestone, drawn from
// tokens + a parametric brand glyph (zero image assets, per LEARNINGS). The universal share is the
// OS screenshot; we also offer a navigator.share TEXT summary where supported (progressive
// enhancement — no fragile canvas rasterization that would need on-device verification).
import { CircuitBoard, Star, Share2 } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { netWorth, challengeViewFor, type GameState } from "../state/gameState.ts";
import type { ScenarioResult } from "../engine/scenarios.ts";
import { scenarioById } from "../engine/scenarios.ts";
import { encodeChallengeCode, formatScore, scoreMetricLabel } from "../engine/challenges.ts";
import { format } from "../engine/money.ts";
import { eraName } from "../engine/eras.ts";
import "./resultCard.css";

function fmtFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function Stars({ n }: { n: number }) {
  return (
    <span className="rcard__stars" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={18} fill={i <= n ? "currentColor" : "none"}
          className={i <= n ? "rcard__star rcard__star--on" : "rcard__star"} strokeWidth={1.8} />
      ))}
    </span>
  );
}

export function ResultCard({ state, result }: { state: GameState; result: ScenarioResult | null }) {
  const scn = state.activeScenario ? scenarioById(state.activeScenario) : null;
  const chv = challengeViewFor(state);
  const rev = format(state.cumulativeRevenue);
  const worth = format(netWorth(state));
  const years = (state.week / 52).toFixed(1);

  const stats: { label: string; value: string }[] = [
    { label: "Lifetime revenue", value: rev },
    { label: "Net worth", value: worth },
    { label: "Products shipped", value: String(state.launched.length) },
    { label: "Fans", value: fmtFans(state.fans) },
  ];

  // Challenge run → challenge-flavoured card (with a shareable code). Scenario → name + stars.
  // Otherwise a freeform company summary.
  const chScore = chv ? formatScore(chv.challenge.scoreMetric, chv.final ?? chv.current) : null;
  const chCode = chv ? encodeChallengeCode(chv.challenge.kind, chv.challenge.dateKey) : null;
  const headline = scn ? scn.name : chv ? `${chv.challenge.kind === "weekly" ? "Weekly" : "Daily"} Challenge` : `${eraName(state.era)} empire`;
  const sub = scn
    ? (result?.stars === 3 ? "Mastered — all three stars" : result?.won ? `${result.stars}★ earned` : scn.tagline)
    : chv
    ? `${chScore} ${scoreMetricLabel(chv.challenge.scoreMetric)}${chv.final == null ? " so far" : ""}`
    : `${state.companyName} · Year ${years}`;

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = () => {
    const line = scn
      ? `I just earned ${result?.stars ?? 0}★ in "${scn.name}" on Silicon: Tech Tycoon — ${state.companyName}, ${rev} lifetime revenue.`
      : chv
      ? `I scored ${chScore} ${scoreMetricLabel(chv.challenge.scoreMetric)} in a Silicon: Tech Tycoon challenge. Beat it — code ${chCode}.`
      : `${state.companyName} on Silicon: Tech Tycoon — ${worth} net worth, ${rev} lifetime revenue, ${fmtFans(state.fans)} fans.`;
    navigator.share?.({ title: "Silicon: Tech Tycoon", text: line }).catch(() => { /* user cancelled / unsupported */ });
  };

  return (
    <div className="rcard-wrap">
      {/* The card itself — designed to look great as a screenshot. */}
      <div className="rcard" role="img" aria-label={`${state.companyName} — ${headline}, ${sub}`}>
        <div className="rcard__head">
          <span className="rcard__brand"><CircuitBoard size={20} strokeWidth={1.8} /></span>
          <span className="rcard__company">{state.companyName}</span>
          {scn && <Stars n={result?.stars ?? 0} />}
        </div>

        <div className="rcard__hero">
          <span className="rcard__headline">{headline}</span>
          <span className="rcard__sub">{sub}</span>
        </div>

        <div className="rcard__stats">
          {stats.map((s) => (
            <div key={s.label} className="rcard__stat">
              <span className="rcard__stat-val tnum">{s.value}</span>
              <span className="rcard__stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {chCode && (
          <div className="rcard__code">Challenge code <strong>{chCode}</strong> — beat my score</div>
        )}

        <div className="rcard__foot">
          <span className="rcard__wordmark">SILICON</span>
          <span className="rcard__wordmark-sub">Tech Tycoon · Wk {state.week}</span>
        </div>
      </div>

      {canShare && (
        <Button block variant="secondary" onClick={share}>
          <Share2 size={15} /> Share
        </Button>
      )}
      <p className="rcard__hint">Screenshot this card to share it anywhere.</p>
    </div>
  );
}
