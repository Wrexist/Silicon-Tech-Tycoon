import { ArrowDownRight, ArrowUpRight, FlaskConical, Landmark, LineChart, PiggyBank, Wallet } from "lucide-react";
import { Sheet } from "../design/primitives.tsx";
import { AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { Glossary } from "./StatGlossary.tsx";
import { TERM_INFO } from "../engine/glossary.ts";
import { format, sub, toDollars } from "../engine/money.ts";
import { holdingsValue } from "../engine/stocks.ts";
import { runwayWeeks } from "../engine/economy.ts";
import { burn, companyValuation, founderStakeValue, netWorth, nextWeekRevenue, weeklyRpGen } from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import "./bank.css";

/** The Bank — a clean, bold finances popup. The single place a player sees, at a glance,
 *  how much money they have, where it's going, and what they're worth. Opened from the HUD
 *  cash (and, on-device, by tapping the office vault). Read-only: trading lives in Market. */
export function Bank({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame();

  const wkRev = nextWeekRevenue(state);
  const wkBurn = burn(state);
  const net = sub(wkRev, wkBurn);
  const runway = runwayWeeks(state.cash, wkBurn, wkRev);
  const runwayTone = runway === Infinity ? "good" : runway < 8 ? "bad" : runway < 20 ? "warn" : "good";
  const runwayText = runway === Infinity ? "Profitable" : runway > 520 ? "10y+ runway" : runway > 52 ? `${Math.round(runway / 52)}y runway` : `${runway} wk runway`;

  const portfolio = holdingsValue(state.holdings, state.competitors);
  const stake = founderStakeValue(state);
  const nw = netWorth(state);
  const rp = Math.floor(state.researchPoints);
  const rpWk = weeklyRpGen(state);

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="bank">
        <div className="bank__head">
          <span className="bank__head-glyph" aria-hidden><Landmark size={18} /></span>
          <h2 className="bank__title">Bank</h2>
        </div>

        {/* Hero: cash on hand + this week's flow */}
        <div className="bank__hero">
          <span className="bank__hero-label">Cash on hand</span>
          <div className={`bank__hero-value${toDollars(state.cash) < 0 ? " bank__hero-value--neg" : ""}`}>
            <AnimatedMoney value={state.cash} />
          </div>
          <div className="bank__flow">
            <span className="bank__flow-chip bank__flow-chip--in">
              <ArrowUpRight size={13} aria-hidden /> {format(wkRev)}/wk in
            </span>
            <span className="bank__flow-chip bank__flow-chip--out">
              <ArrowDownRight size={13} aria-hidden /> {format(wkBurn)}/wk out
            </span>
          </div>
          <div className={`bank__runway bank__runway--${runwayTone}`}>
            <span className="bank__runway-net tnum">{format(net, { sign: true })}/wk</span>
            <span className="bank__runway-sep" aria-hidden>·</span>
            <span>{runwayText}</span>
          </div>
        </div>

        {/* Net worth, broken into its parts so it's obvious what you're worth and why */}
        <div className="bank__section-label">Your wealth</div>
        <div className="bank__networth">
          <span className="bank__networth-label">Net worth</span>
          <span className="bank__networth-value"><AnimatedMoney value={nw} /></span>
        </div>
        <div className="bank__rows">
          <Row glyph={<Wallet size={16} />} label="Cash" value={format(state.cash)} />
          <Row glyph={<PiggyBank size={16} />} label={`Your company${state.listed ? ` · you own ${Math.round(state.ownership * 100)}%` : ""}`} value={format(stake)} sub={state.listed ? undefined : `Worth ${format(companyValuation(state))}`} />
          <Row glyph={<LineChart size={16} />} label="Rival shares" value={format(portfolio)} sub={toDollars(portfolio) === 0 ? "Buy shares in the Market tab" : undefined} />
        </div>

        {/* The other currency: research */}
        <div className="bank__section-label">Research</div>
        <div className="bank__rows">
          <Row
            glyph={<FlaskConical size={16} />}
            label="Research points"
            value={`${rp} RP`}
            sub={`+${rpWk.toFixed(1)}/wk`}
            accent
          />
        </div>

        <div className="bank__footer">
          <span>Lifetime earned</span>
          <span className="tnum">{format(state.cumulativeRevenue)}</span>
        </div>

        <div className="bank__glossary">
          <Glossary entries={TERM_INFO} label="What these terms mean" />
        </div>
      </div>
    </Sheet>
  );
}

function Row({ glyph, label, value, sub, accent }: { glyph: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bank__row">
      <span className={`bank__row-glyph${accent ? " bank__row-glyph--accent" : ""}`} aria-hidden>{glyph}</span>
      <div className="bank__row-text">
        <span className="bank__row-label">{label}</span>
        {sub && <span className="bank__row-sub">{sub}</span>}
      </div>
      <span className="bank__row-value tnum">{value}</span>
    </div>
  );
}
