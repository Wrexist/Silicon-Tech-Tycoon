import { useState } from "react";
import { Building2, Minus, Newspaper, Package, Plus, Sparkles, TrendingDown, TrendingUp, Wand2 } from "lucide-react";
import { Button, Card, EmptyState, Sheet, SectionHeader, Slider, Stat, StatPill } from "../design/primitives.tsx";
import { CategoryIcon } from "../design/icons.tsx";
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
import type { CategoryId, CompetitorState, LaunchedProduct, Product, Stats } from "../engine/types.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { Sparkline, SalesCurveChart } from "../components/charts.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import "./market.css";

const CATEGORY_LABEL: Record<string, string> = {
  phone: "Phone", tablet: "Tablet", laptop: "Laptop", desktop: "Desktop",
  monitor: "Monitor", console: "Console", wearable: "Wearable", experimental: "AR/VR",
};

type Verdict = "hit" | "solid" | "steady" | "flop";
const VERDICT_LABEL: Record<Verdict, string> = { hit: "Hit", solid: "Solid", steady: "Steady", flop: "Flop" };
const VERDICT_TONE: Record<Verdict, "positive" | "accent" | "negative"> = {
  hit: "positive", solid: "positive", steady: "accent", flop: "negative",
};
/** Verdict for a launched product — stored if present, else derived from the launch score. */
function verdictOf(lp: LaunchedProduct): Verdict {
  if (lp.verdict) return lp.verdict as Verdict;
  return lp.launchScore >= 76 ? "hit" : lp.launchScore <= 22 ? "flop" : lp.launchScore >= 45 ? "solid" : "steady";
}

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

export function Market({ onDesignSuccessor, onOpenDesignLab }: { onDesignSuccessor?: (p: Product) => void; onOpenDesignLab?: () => void } = {}) {
  const { state } = useGame();
  const trends = state.trends;
  const comps = state.competitors;
  const feedItems = [...state.feed].slice(-12).reverse();
  const maxTrend = Math.max(...STAT_KEYS.map((k) => trends.targetWeights[k]));
  const [trade, setTrade] = useState<CompetitorState | null>(null);
  const [ipo, setIpo] = useState(false);
  const [sellStake, setSellStake] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = state.launched.find((l) => l.product.id === detailId) ?? null;

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
          <StatPill label="Fans" value={state.fans >= 1000 ? `${(state.fans / 1000).toFixed(1)}k` : String(state.fans)} tone={state.fans > 0 ? "positive" : "neutral"} />
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

      {/* Your launched products — tap one to see why it performed + design a successor */}
      <Card>
        <SectionHeader title="Your products" accessory={state.launched.length > 0 ? `${state.launched.length} launched` : undefined} />
        {state.launched.length === 0 ? (
          <EmptyState
            glyph={<Package size={36} strokeWidth={1.6} />}
            title="Nothing launched yet"
            sub="Design a product, build it, and launch it to see how the market responds."
            action={onOpenDesignLab && <Button variant="secondary" onClick={onOpenDesignLab}>Open Design Lab</Button>}
          />
        ) : (
          <div className="mkt__products">
            {[...state.launched]
              .sort((a, b) => {
                const aLive = a.weeksElapsed < a.weeklyUnits.length ? 1 : 0;
                const bLive = b.weeksElapsed < b.weeklyUnits.length ? 1 : 0;
                if (aLive !== bLive) return bLive - aLive;
                return b.revenueToDate - a.revenueToDate;
              })
              .map((lp) => {
                const v = verdictOf(lp);
                const live = lp.weeksElapsed < lp.weeklyUnits.length;
                return (
                  <button
                    key={lp.product.id}
                    className="mkt__product"
                    onClick={() => { setDetailId(lp.product.id); haptic.light(); }}
                    aria-label={`View ${lp.product.name} performance`}
                  >
                    <span className="mkt__product-thumb"><DeviceRenderer product={lp.product} size={44} /></span>
                    <span className="mkt__product-info">
                      <span className="mkt__product-name">{lp.product.name}</span>
                      <span className="mkt__product-sub">
                        <CategoryIcon id={lp.product.category} size={12} /> {lp.unitsSold.toLocaleString()} sold · {format(lp.revenueToDate)}
                      </span>
                    </span>
                    <span className="mkt__product-end">
                      <StatPill value={VERDICT_LABEL[v]} tone={VERDICT_TONE[v]} />
                      {live && <span className="mkt__product-live">selling</span>}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </Card>

      {/* Stock exchange */}
      <SectionHeader title="Stock Exchange" accessory="trade rival shares" />
      {comps.map((c) => {
        const ch = changePct(c.priceHistory);
        const owned = state.holdings[c.id] ?? 0;
        const activeCats = Object.entries(c.strengthByCategory)
          .filter(([, s]) => (s as number) > 20)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([cat]) => cat as CategoryId);
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
              {activeCats.length > 0 && (
                <div className="mkt__stock-cats">
                  {activeCats.map((cat) => (
                    <span key={cat} className="mkt__stock-cat">
                      <CategoryIcon id={cat} size={10} />{CATEGORY_LABEL[cat] ?? cat}
                    </span>
                  ))}
                </div>
              )}
            </button>
          </Card>
        );
      })}

      {/* Trends */}
      <Card>
        <SectionHeader title="What the market wants" accessory={eraName(state.era)} />
        <div className="mkt__trends">
          {STAT_KEYS.map((k) => {
            const cur = trends.weights[k];
            const target = trends.targetWeights[k];
            const pct = maxTrend > 0 ? Math.round((target / maxTrend) * 100) : 0;
            const delta = target - cur;
            const rising = delta > 0.008;
            const falling = delta < -0.008;
            return (
              <div key={k} className="mkt__trend">
                <span className="mkt__trend-label">
                  {STAT_LABEL[k]}
                  {rising && <TrendingUp size={11} className="mkt__trend-arrow mkt__trend-arrow--up" aria-label="rising" />}
                  {falling && <TrendingDown size={11} className="mkt__trend-arrow mkt__trend-arrow--down" aria-label="falling" />}
                </span>
                <div className="mkt__trend-bar">
                  <div className="mkt__trend-fill" style={{ width: `${pct}%` }} />
                  <span className="mkt__trend-val tnum">{Math.round(target * 100)}</span>
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
            title={state.launched.length > 0 ? "Activity will appear soon" : "No activity yet"}
            sub={state.launched.length > 0
              ? "Market events and product milestones appear here as the weeks advance."
              : "Launch your first product to start seeing market headlines."}
            action={state.launched.length === 0 && onOpenDesignLab
              ? <Button variant="secondary" onClick={onOpenDesignLab}>Open Design Lab</Button>
              : undefined}
          />
        ) : (
          <ul className="mkt__feed">
            {feedItems.map((f) => (
              <li key={f.id} className={`mkt__feed-item mkt__feed-item--${f.tone}`}>
                <span className="mkt__feed-week">wk {f.week}</span>
                {f.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={!!detail} onClose={() => setDetailId(null)}>
        {detail && (
          <ProductDetailSheet
            lp={detail}
            onClose={() => setDetailId(null)}
            onDesignSuccessor={onDesignSuccessor ? (p) => { setDetailId(null); onDesignSuccessor(p); } : undefined}
          />
        )}
      </Sheet>

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

/* ---------- Post-launch product detail ---------- */

type DriverTone = "positive" | "accent" | "negative" | "neutral";
interface Driver {
  label: string;
  value: string;
  detail: string;
  tone: DriverTone;
}

/** Build the "why it performed" drivers in plain language. Prefers the launch-moment snapshot
 *  (insight) recorded on the product; falls back to a qualitative read from the launch score for
 *  saves written before insight existed — never fabricating numbers we don't have. */
function performanceDrivers(lp: LaunchedProduct): Driver[] {
  const ins = lp.insight;
  const drivers: Driver[] = [];

  // 1) Demand fit — how well the stats matched what consumers wanted at launch.
  if (ins) {
    const f = Math.round(ins.demandFit);
    drivers.push({
      label: "Demand fit",
      value: `${f}/100`,
      detail: f >= 60 ? "Closely matched what the market wanted." : f >= 35 ? "A decent match for the trend." : "Out of step with what buyers wanted.",
      tone: f >= 60 ? "positive" : f >= 35 ? "accent" : "negative",
    });
  } else {
    const hi = lp.launchScore >= 76;
    const lo = lp.launchScore <= 22;
    drivers.push({
      label: "Demand fit",
      value: hi ? "Strong" : lo ? "Weak" : "Fair",
      detail: hi ? "Read the market well at launch." : lo ? "Mistimed the market." : "An average read on the trend.",
      tone: hi ? "positive" : lo ? "negative" : "accent",
    });
  }

  // 2) Price positioning — value buy vs. on-the-money vs. overpriced.
  if (ins) {
    const pf = ins.priceFit;
    const over = pf < 0.8;
    const under = pf > 1.12;
    drivers.push({
      label: "Price",
      value: over ? "Overpriced" : under ? "Value buy" : "On the money",
      detail: over ? "Buyers felt it cost too much for the spec." : under ? "Priced below its perceived value — drove volume." : "Priced fairly for what it delivered.",
      tone: over ? "negative" : under ? "positive" : "accent",
    });
  }

  // 3) Competition pressure — rivals splitting or beating the market.
  if (ins) {
    const beats = ins.betterRivals;
    const matches = ins.matchingRivals;
    const kept = Math.round(ins.competitionFactor * 100);
    drivers.push({
      label: "Competition",
      value: beats > 0 ? `${beats} ahead` : matches > 0 ? `${matches} matched` : "Clear field",
      detail: beats > 0
        ? `Rivals outclassed you — you kept ~${kept}% of demand.`
        : matches > 0
          ? `Rivals split the market — you kept ~${kept}% of demand.`
          : "No rival came close — you owned the category.",
      tone: beats > 0 ? "negative" : matches > 0 ? "accent" : "positive",
    });
  }

  // 4) Hype — reputation + marketing reach at launch.
  if (ins) {
    const h = ins.hype;
    const strong = h >= 1.6;
    const weak = h < 1.1;
    drivers.push({
      label: "Hype",
      value: strong ? "High" : weak ? "Low" : "Moderate",
      detail: strong ? "Reputation and marketing gave a big launch boost." : weak ? "Little buzz — few buyers knew it existed." : "A steady amount of launch buzz.",
      tone: strong ? "positive" : weak ? "negative" : "accent",
    });
  }

  return drivers;
}

function ProductDetailSheet({
  lp,
  onClose,
  onDesignSuccessor,
}: {
  lp: LaunchedProduct;
  onClose: () => void;
  onDesignSuccessor?: (p: Product) => void;
}) {
  const v = verdictOf(lp);
  const drivers = performanceDrivers(lp);
  const sellThrough = lp.plannedUnits && lp.plannedUnits > 0
    ? Math.min(100, Math.round((lp.unitsSold / lp.plannedUnits) * 100))
    : null;
  const live = lp.weeksElapsed < lp.weeklyUnits.length;

  return (
    <div className="pd">
      <div className="pd__head">
        <span className="pd__cat" aria-hidden><CategoryIcon id={lp.product.category} size={18} /></span>
        <div className="pd__head-text">
          <h2 className="pd__title">{lp.product.name}</h2>
          <p className="pd__sub">{CATEGORY_LABEL[lp.product.category] ?? lp.product.category} · launched week {lp.launchedWeek}</p>
        </div>
        <StatPill value={VERDICT_LABEL[v]} tone={VERDICT_TONE[v]} />
      </div>

      <div className="pd__hero">
        <DeviceRenderer product={lp.product} size={150} idle />
      </div>

      {/* Sales curve */}
      <div className="pd__curve">
        <div className="pd__curve-cap">
          <span className="pd__curve-label">Sales by week{live ? " · still selling" : ""}</span>
          <span className="pd__curve-week tnum">wk {Math.min(lp.weeksElapsed, lp.weeklyUnits.length)}/{lp.weeklyUnits.length}</span>
        </div>
        <SalesCurveChart weekly={lp.weeklyUnits} elapsed={lp.weeksElapsed} />
      </div>

      <div className="pd__stats">
        <Stat label="Units sold" value={lp.unitsSold.toLocaleString()} hint={`of ${lp.totalUnits.toLocaleString()} forecast`} />
        <Stat label="Revenue" value={format(lp.revenueToDate)} tone="positive" />
        <Stat
          label="Sell-through"
          value={sellThrough != null ? `${sellThrough}%` : "—"}
          tone={sellThrough != null && sellThrough >= 90 ? "positive" : "neutral"}
          hint={lp.plannedUnits != null ? `${lp.plannedUnits.toLocaleString()} made` : undefined}
        />
      </div>

      {/* Product specs */}
      <div className="pd__specs">
        {STAT_KEYS.map((k) => (
          <div key={k} className="pd__spec">
            <span className="pd__spec-label">{STAT_LABEL[k]}</span>
            <div className="pd__spec-track">
              <div className="pd__spec-fill" style={{ width: `${Math.min(100, lp.stats[k])}%` }} />
            </div>
            <span className="pd__spec-val tnum">{Math.round(lp.stats[k])}</span>
          </div>
        ))}
      </div>

      {/* Why it performed */}
      <div className="pd__why">
        <div className="pd__why-head">
          <Sparkles size={15} aria-hidden />
          <span>Why it {v === "hit" ? "won" : v === "flop" ? "flopped" : v === "solid" ? "delivered" : "performed"}</span>
        </div>
        <ul className="pd__drivers">
          {drivers.map((d) => (
            <li className="pd__driver" key={d.label}>
              <div className="pd__driver-top">
                <span className="pd__driver-label">{d.label}</span>
                <span className={`pd__driver-value pd__driver-value--${d.tone} tnum`}>{d.value}</span>
              </div>
              <p className="pd__driver-detail">{d.detail}</p>
            </li>
          ))}
        </ul>
        {!lp.insight && (
          <p className="pd__why-note">Detailed launch metrics weren't recorded for this older product — shown as an overall read.</p>
        )}
      </div>

      {onDesignSuccessor && (
        <Button block onClick={() => { onDesignSuccessor(lp.product); haptic.success(); }}>
          <Wand2 size={16} /> Design a successor
        </Button>
      )}
      <Button block variant="tertiary" onClick={onClose}>Close</Button>
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
        <StatPill label="Rep" value={Math.round(comp.reputation)} tone={comp.reputation >= 60 ? "positive" : "neutral"} />
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
