import type { GameState } from "../state/gameState.ts";
import { formatShortDollars } from "../engine/money.ts";

/** Change vs the previous RECORDED week, as a short signed percentage — or null when there is no
 *  prior row or the base is zero/negative (a % of a loss reads backwards). */
function vsLastWeek(now: number, before: number | undefined): { text: string; up: boolean } | null {
  if (before == null || before <= 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: "level with last week", up: true };
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs last week`, up: pct > 0 };
}

/** Read-only recap of recorded facts; never reconstructs or fabricates prior weeks. */
export function WeeklyRecap({ state }: { state: GameState }) {
  const row = state.financialHistory?.at(-1);
  const prev = state.financialHistory?.at(-2);
  const week = row?.week ?? state.week;
  const events = state.feed.filter(f => f.week === week).slice(-5);
  const revDelta = row ? vsLastWeek(row.revenue, prev?.revenue) : null;
  const profitDelta = row ? vsLastWeek(row.profit, prev?.profit) : null;
  const delta = (d: ReturnType<typeof vsLastWeek>) =>
    d && <span className={`weekly-recap__delta weekly-recap__delta--${d.up ? "up" : "down"}`}>{d.text}</span>;
  return <details className="mg-disclosure weekly-recap"><summary>Week {week} recap</summary>
    {row ? <dl><div><dt>Recorded revenue</dt><dd>{formatShortDollars(row.revenue)}{delta(revDelta)}</dd></div><div><dt>Recorded outflow</dt><dd>{formatShortDollars(row.expenses)}</dd></div><div><dt>Weekly cash surplus</dt><dd>{formatShortDollars(row.profit)}{delta(profitDelta)}</dd></div></dl> : <p>No completed financial week recorded yet.</p>}
    {events.length ? <ul>{events.map((f, i) => <li key={i}>{f.text}</li>)}</ul> : <p>No recorded events for this week.</p>}
    <p className="mg-footnote">Based on the saved weekly ledger and activity feed. Upfront investments are tracked separately.</p>
  </details>;
}
