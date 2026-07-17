// Founder Legend — the cross-run prestige ladder. Where Achievements are discrete milestones and the
// Museum is your device history, this is your CAREER standing: one endless title that climbs with your
// lifetime record across every company. Always a next rung to grind toward. Reads the profile store
// (getFounderRecord) + the live run (so the bar nudges up mid-game); writes nothing.
import { Check, Crown, Lock } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { toDollars } from "../engine/money.ts";
import { ipoValuation, industryRank, type GameState } from "../state/gameState.ts";
import {
  getFounderRecord,
  legendStanding,
  liveLegendScore,
  LEGEND_TIERS,
} from "../state/founderLegend.ts";
import { ascensionName } from "../engine/ascension.ts";
import "./founderLegend.css";

function runHits(state: GameState): number {
  return state.launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
}

export function FounderLegendSheet({ state, onClose }: { state: GameState; onClose: () => void }) {
  const record = getFounderRecord();
  // Fold the live run into the stored record so the standing reflects what's happening right now.
  const liveScore = liveLegendScore(record, {
    hitsInRun: runHits(state),
    valuationDollars: toDollars(ipoValuation(state)),
    rank: industryRank(state),
    ascension: state.ascensionLevel,
  });
  const st = legendStanding(liveScore);
  const pct = Math.round(st.progress * 100);
  const toNext = Math.max(0, st.nextMin - st.score);

  const peak = record.peakValuationDollars > 0 ? formatDollars(record.peakValuationDollars) : "—";

  const stats: { label: string; value: string }[] = [
    { label: "Companies founded", value: String(record.prestiges + 1) },
    { label: "New Game+ ascensions", value: String(record.prestiges) },
    { label: "IPOs", value: String(record.ipos) },
    { label: "Best hits in one run", value: String(record.bestHitsInRun) },
    { label: "Peak valuation", value: peak },
    { label: "Best industry rank", value: record.bestRank <= 100 ? `#${record.bestRank}` : "—" },
    { label: "Highest Heat cleared", value: record.bestAscension > 0 ? ascensionName(record.bestAscension) : "—" },
  ];

  return (
    <div className="fl">
      <div className="fl__head">
        <span className="fl__head-glyph" aria-hidden><Crown size={22} /></span>
        <div>
          <h2 className="fl__title">Founder Legend</h2>
          <p className="fl__sub">Your standing across every company you've ever run.</p>
        </div>
      </div>

      {/* Current standing — the hero rung. */}
      <div className="fl__standing">
        <span className="fl__standing-label">Current title</span>
        <span className="fl__standing-title">{st.title}</span>
        <div className="fl__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to ${st.nextTitle}`}>
          <div className="fl__bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="fl__standing-next">
          {toNext > 0 ? <><b>{toNext}</b> legend points to <b>{st.nextTitle}</b></> : <>Next: <b>{st.nextTitle}</b></>}
        </span>
      </div>

      {/* The ladder. Named rungs; past the top it continues endlessly as numbered Legends. */}
      <ol className="fl__ladder">
        {LEGEND_TIERS.map((tier, i) => {
          const reached = liveScore >= tier.minScore;
          const current = i === st.tierIndex;
          return (
            <li key={tier.name} className={`fl__rung${reached ? " fl__rung--reached" : ""}${current ? " fl__rung--current" : ""}`}>
              <span className="fl__rung-mark" aria-hidden>
                {current ? <Crown size={15} /> : reached ? <Check size={15} /> : <Lock size={13} />}
              </span>
              <span className="fl__rung-name">{tier.name}</span>
              {current && <span className="fl__rung-tag">You are here</span>}
              {!current && <span className="fl__rung-req tnum">{tier.minScore}</span>}
            </li>
          );
        })}
        <li className="fl__rung fl__rung--endless">
          <span className="fl__rung-mark" aria-hidden>∞</span>
          <span className="fl__rung-name">Founding Legend II, III, IV…</span>
          <span className="fl__rung-req">endless</span>
        </li>
      </ol>

      {/* Lifetime record. */}
      <div className="fl__stats">
        {stats.map((s) => (
          <div key={s.label} className="fl__stat">
            <span className="fl__stat-value tnum">{s.value}</span>
            <span className="fl__stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}

/** peakValuationDollars is stored in whole dollars; render it with the same M/B/T shorthand as money. */
function formatDollars(dollars: number): string {
  if (dollars >= 1_000_000_000_000) return `$${(dollars / 1_000_000_000_000).toFixed(1)}T`;
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}k`;
  return `$${Math.round(dollars)}`;
}
