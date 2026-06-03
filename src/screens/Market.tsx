import { useState } from "react";
import { Building2, Minus, Newspaper, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { Button, Card, EmptyState, Sheet, SectionHeader, Slider, Stat, StatPill } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { eraName } from "../engine/eras.ts";
import { dollars, format, toDollars, cents } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import { buyCost, sellProceeds } from "../engine/stocks.ts";
import {
  canList,
  companyValuation,
  founderStakeValue,
  netWorth,
} from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import type { CompetitorState, Stats } from "../engine/types.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { Sparkline } from "../components/charts.tsx";
import "./market.css";

const STAT_LABEL: Record<keyof Stats, string> = {
  performance: "Performance",
  quality: "Quality",
  battery: "Battery",
  design: "Design",
  ecosystem: "Ecosystem",
};

function changePct(history: number[]): number {
  if (history.length < 2) return 0;
  const a = history[history.length - 2];
  const b = history[history.length - 1];
  return a > 0 ? ((b - a) / a) * 100 : 0;
}

export function Market() {
  const { state } = useGame();
  const trends = state.trends;
  const comps = state.competitors;
  const feedItems = [...state.feed].slice(-12).reverse();
  const maxTrend = Math.max(...STAT_KEYS.map((k) => trends.targetWeights[k]));
  const [trade, setTrade] = useState<CompetitorState | null>(null);
  const [ipo, setIpo] = useState(false);
  const [sellStake, setSellStake] = useState(false);

  const valuation = companyValuation(state);
  const stake = founderStakeValue(state);
  const net = netWorth(state);
  const listable = canList(state);

  return (
    <div className="mkt">
      {/* Net worth banner */}
      <Card className="mkt__networth">
        <div className="mkt__nw-main">
          <span className="mkt__nw-label">Net worth</span>
          <span className="mkt__nw-value rounded tnum">{format(net)}</span>
        </div>
        <div className="mkt__nw-row">
          <StatPill label="Cash" value={format(state.cash)} />
          <StatPill label="Reputation" value={Math.round(state.reputation)} tone={state.reputation >= 50 ? "positive" : "neutral"} />
        </div>
      </Card>

      {/* Your company (equity) */}
      <Card className="mkt__co">
        <SectionHeader title={state.companyName} accessory={state.listed ? "publicly traded" : "private"} />
        <div className="mkt__co-grid">
          <Stat label="Valuation" value={format(valuation)} />
          <Stat label="You own" value={`${Math.round(state.ownership * 100)}%`} />
          <Stat label="Your stake" value={format(stake)} tone="positive" />
        </div>
        {!state.listed ? (
          listable ? (
            <Button block onClick={() => { setIpo(true); haptic.light(); }}>
              <Building2 size={16} /> Take {state.companyName} public (IPO)
            </Button>
          ) : (
            <p className="mkt__co-hint">
              IPO unlocks at {format(BALANCE.ipo.minRevenueToList)} lifetime revenue — you're at {format(state.cumulativeRevenue)}.
            </p>
          )
        ) : (
          <Button block variant="secondary" onClick={() => { setSellStake(true); haptic.light(); }} disabled={state.ownership <= 0.06}>
            Sell more shares
          </Button>
        )}
      </Card>

      {/* Stock exchange */}
      <SectionHeader title="Stock Exchange" accessory="trade rival shares" />
      {comps.map((c) => {
        const ch = changePct(c.priceHistory);
        const owned = state.holdings[c.id] ?? 0;
        return (
          <Card key={c.id} className="mkt__stock">
            <button className="mkt__stock-btn" onClick={() => { setTrade(c); haptic.light(); }} aria-label={`Trade ${c.name}`}>
              <div className="mkt__stock-head">
                <div className="mkt__stock-id">
                  <span className="mkt__stock-name">{c.name}</span>
                  <span className="mkt__stock-blurb">{c.blurb}</span>
                </div>
                <div className="mkt__stock-price">
                  <span className="tnum">{format(cents(c.sharePrice))}</span>
                  <span className={`mkt__stock-chg ${ch >= 0 ? "up" : "down"} tnum`}>
                    {ch >= 0 ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />} {Math.abs(ch).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mkt__stock-foot">
                <div className="mkt__stock-spark"><Sparkline data={c.priceHistory} stroke={ch >= 0 ? "var(--positive)" : "var(--negative)"} /></div>
                {owned > 0 && <span className="mkt__stock-owned">{owned} sh · {format(cents(owned * c.sharePrice))}</span>}
              </div>
            </button>
          </Card>
        );
      })}

      {/* Trends */}
      <Card>
        <SectionHeader title="What the market wants" accessory={eraName(state.era)} />
        <div className="mkt__trends">
          {STAT_KEYS.map((k) => {
            const v = trends.targetWeights[k];
            const pct = maxTrend > 0 ? Math.round((v / maxTrend) * 100) : 0;
            return (
              <div key={k} className="mkt__trend">
                <span className="mkt__trend-label">{STAT_LABEL[k]}</span>
                <div className="mkt__trend-bar">
                  <div className="mkt__trend-fill" style={{ width: `${pct}%` }} />
                  <span className="mkt__trend-val tnum">{Math.round(v * 100)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Activity feed */}
      <Card>
        <SectionHeader title="Activity" accessory="latest" />
        {feedItems.length === 0 ? (
          <EmptyState
            glyph={<Newspaper size={36} strokeWidth={1.6} />}
            title="No activity yet"
            sub="Design and launch a product to start making headlines."
          />
        ) : (
          <ul className="mkt__feed">
            {feedItems.map((f) => (
              <li key={f.id} className={`mkt__feed-item mkt__feed-item--${f.tone}`}>{f.text}</li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={!!trade} onClose={() => setTrade(null)}>
        {trade && <TradeSheet comp={comps.find((c) => c.id === trade.id) ?? trade} onClose={() => setTrade(null)} />}
      </Sheet>
      <Sheet open={ipo} onClose={() => setIpo(false)}>
        {ipo && <IPOSheet onClose={() => setIpo(false)} />}
      </Sheet>
      <Sheet open={sellStake} onClose={() => setSellStake(false)}>
        {sellStake && <SellStakeSheet onClose={() => setSellStake(false)} />}
      </Sheet>
    </div>
  );
}

function TradeSheet({ comp, onClose }: { comp: CompetitorState; onClose: () => void }) {
  const { state, buyShares, sellShares } = useGame();
  const [qty, setQty] = useState(1);
  const owned = state.holdings[comp.id] ?? 0;
  const cost = buyCost(comp.sharePrice, qty);
  const proceeds = sellProceeds(comp.sharePrice, qty);
  const canBuy = state.cash >= cost;
  const maxBuy = Math.floor(toDollars(state.cash) / (toDollars(cost) / qty || 1));

  return (
    <div className="trade">
      <div className="trade__head">
        <div>
          <h2 className="trade__title">{comp.name}</h2>
          <p className="trade__sub">{comp.blurb}</p>
        </div>
        <span className="trade__price rounded tnum">{format(cents(comp.sharePrice))}</span>
      </div>
      <div className="trade__row">
        <StatPill label="You own" value={`${owned} sh`} />
        <StatPill label="Value" value={format(cents(owned * comp.sharePrice))} tone={owned > 0 ? "positive" : "neutral"} />
      </div>

      <div className="trade__qty">
        <span className="trade__qty-label">Shares</span>
        <div className="trade__stepper">
          <button onClick={() => { setQty((q) => Math.max(1, q - 1)); haptic.light(); }} aria-label="Fewer shares"><Minus size={16} /></button>
          <span className="trade__qty-val tnum">{qty}</span>
          <button onClick={() => { setQty((q) => q + 1); haptic.light(); }} aria-label="More shares"><Plus size={16} /></button>
        </div>
      </div>
      <div className="trade__presets">
        {[5, 25, 100].map((n) => (
          <button key={n} className="trade__preset" onClick={() => { setQty(n); haptic.light(); }}>{n}</button>
        ))}
        {maxBuy > 0 && <button className="trade__preset" onClick={() => { setQty(Math.max(1, maxBuy)); haptic.light(); }}>Max</button>}
      </div>

      <div className="trade__actions">
        <Button
          block
          disabled={!canBuy}
          onClick={() => { buyShares(comp.id, qty); haptic.success(); sfx("tap"); showToast(`Bought ${qty} ${comp.name}`, { tone: "positive" }); }}
        >
          Buy · {format(cost)}
        </Button>
        <Button
          block
          variant="secondary"
          disabled={owned <= 0}
          onClick={() => { const q = Math.min(qty, owned); sellShares(comp.id, q); haptic.light(); showToast(`Sold ${q} ${comp.name}`, { tone: "neutral" }); }}
        >
          Sell · {format(proceeds)}
        </Button>
      </div>
      {owned > 0 && (
        <Button block variant="tertiary" onClick={() => { sellShares(comp.id, owned); haptic.medium(); onClose(); }}>
          Sell all {owned}
        </Button>
      )}
    </div>
  );
}

function IPOSheet({ onClose }: { onClose: () => void }) {
  const { state, listCompany } = useGame();
  const [pct, setPct] = useState(BALANCE.ipo.defaultStake * 100);
  const valuation = companyValuation(state);
  const raised = toDollars(valuation) * (pct / 100);
  return (
    <div className="trade">
      <div className="trade__head">
        <div>
          <h2 className="trade__title">Take {state.companyName} public</h2>
          <p className="trade__sub">Sell a stake on the exchange for a cash infusion — you keep the rest.</p>
        </div>
      </div>
      <div className="trade__row">
        <StatPill label="Valuation" value={format(valuation)} tone="accent" />
        <StatPill label="You'll keep" value={`${Math.round(100 - pct)}%`} tone="positive" />
      </div>
      <div className="trade__ipo-amount rounded tnum">+{format(dollars(Math.round(raised)))}</div>
      <Slider value={pct} min={5} max={BALANCE.ipo.maxStakePerSale * 100} step={1} ariaLabel="Stake to sell" accent="var(--accent)" onChange={setPct} />
      <p className="trade__ipo-pct">Sell {Math.round(pct)}%</p>
      <Button block onClick={() => { listCompany(pct / 100); haptic.success(); sfx("era"); showToast(`${state.companyName} is now public!`, { tone: "positive", glyph: <Building2 size={15} /> }); onClose(); }}>
        Confirm IPO
      </Button>
    </div>
  );
}

function SellStakeSheet({ onClose }: { onClose: () => void }) {
  const { state, sellOwnStake } = useGame();
  const maxSell = Math.max(0, state.ownership - 0.05) * 100;
  const [pct, setPct] = useState(Math.min(10, maxSell));
  const valuation = companyValuation(state);
  const raised = toDollars(valuation) * (pct / 100);
  return (
    <div className="trade">
      <div className="trade__head">
        <div>
          <h2 className="trade__title">Sell shares</h2>
          <p className="trade__sub">Cash out more of your stake (you'll keep at least 5%).</p>
        </div>
      </div>
      <div className="trade__row">
        <StatPill label="You own" value={`${Math.round(state.ownership * 100)}%`} />
        <StatPill label="After" value={`${Math.round(state.ownership * 100 - pct)}%`} />
      </div>
      <div className="trade__ipo-amount rounded tnum">+{format(dollars(Math.round(raised)))}</div>
      <Slider value={pct} min={1} max={Math.max(1, maxSell)} step={1} ariaLabel="Stake to sell" accent="var(--accent)" onChange={setPct} />
      <p className="trade__ipo-pct">Sell {Math.round(pct)}%</p>
      <Button block onClick={() => { sellOwnStake(pct / 100); haptic.success(); showToast(`Sold ${Math.round(pct)}% of ${state.companyName}`, { tone: "positive" }); onClose(); }}>
        Confirm sale
      </Button>
    </div>
  );
}
