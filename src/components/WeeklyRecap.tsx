import type { GameState } from "../state/gameState.ts";
import { formatShortDollars } from "../engine/money.ts";

/** Read-only recap of recorded facts; never reconstructs or fabricates prior weeks. */
export function WeeklyRecap({ state }: { state: GameState }) {
  const row = state.financialHistory?.at(-1);
  const week = row?.week ?? state.week;
  const events = state.feed.filter(f => f.week === week).slice(-5);
  return <details className="mg-disclosure weekly-recap"><summary>Week {week} recap</summary>
    {row ? <dl><div><dt>Recorded revenue</dt><dd>{formatShortDollars(row.revenue)}</dd></div><div><dt>Recorded outflow</dt><dd>{formatShortDollars(row.expenses)}</dd></div><div><dt>Weekly cash surplus</dt><dd>{formatShortDollars(row.profit)}</dd></div></dl> : <p>No completed financial week recorded yet.</p>}
    {events.length ? <ul>{events.map((f, i) => <li key={i}>{f.text}</li>)}</ul> : <p>No recorded events for this week.</p>}
    <p className="mg-footnote">Based on the saved weekly ledger and activity feed. Upfront investments are tracked separately.</p>
  </details>;
}
